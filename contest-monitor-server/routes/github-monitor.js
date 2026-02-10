const express = require("express");
const { Octokit } = require("@octokit/rest");

const { requireAuth } = require("../middleware/auth");
const logger = require("../utils/logger");
const Participant = require("../models/Participant");
const GitHubAnalysis = require("../models/GitHubAnalysis");
const {
  analyzeCommitPattern,
  analyzeTimingDistribution,
  calculateCommitStats,
} = require("../utils/commitAnalysis");
const { crossCompareRepos, fingerprint } = require("../utils/similarity");

const router = express.Router();

// ---------------------------------------------------------------------------
// Octokit instance (created lazily, shared across requests)
// ---------------------------------------------------------------------------

let _octokit = null;

function getOctokit() {
  if (!_octokit) {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      throw new Error("GITHUB_TOKEN is not configured");
    }
    _octokit = new Octokit({ auth: token });
  }
  return _octokit;
}

// ---------------------------------------------------------------------------
// Helper: fetch commits from GitHub API
// ---------------------------------------------------------------------------

/**
 * Fetch all commits for a repository (paginated).
 *
 * @param {string} owner
 * @param {string} repo
 * @param {string} [since] – ISO date string
 * @returns {Promise<object[]>}
 */
async function fetchCommits(owner, repo, since) {
  const octokit = getOctokit();
  const params = {
    owner,
    repo,
    per_page: 100,
  };
  if (since) params.since = since;

  try {
    const commits = await octokit.paginate(octokit.rest.repos.listCommits, params);
    return commits;
  } catch (err) {
    if (err.status === 404) {
      logger.warn(`Repository ${owner}/${repo} not found or not accessible`);
      return [];
    }
    throw err;
  }
}

/**
 * Fetch detailed stats for a single commit (additions/deletions per file).
 *
 * @param {string} owner
 * @param {string} repo
 * @param {string} ref – commit SHA
 * @returns {Promise<{ additions: number, deletions: number, filesChanged: number }>}
 */
async function fetchCommitDetail(owner, repo, ref) {
  const octokit = getOctokit();
  try {
    const { data } = await octokit.rest.repos.getCommit({ owner, repo, ref });
    return {
      additions: data.stats?.additions || 0,
      deletions: data.stats?.deletions || 0,
      filesChanged: (data.files || []).length,
    };
  } catch (err) {
    logger.warn(`Failed to fetch commit detail ${owner}/${repo}@${ref}: ${err.message}`);
    return { additions: 0, deletions: 0, filesChanged: 0 };
  }
}

/**
 * Fetch file contents from a repository tree (for similarity comparison).
 *
 * @param {string} owner
 * @param {string} repo
 * @param {string} [ref]  – branch or SHA (defaults to default branch)
 * @returns {Promise<{ path: string, content: string }[]>}
 */
async function fetchRepoFiles(owner, repo, ref) {
  const octokit = getOctokit();
  const codeExtensions = new Set([
    "js", "ts", "jsx", "tsx", "py", "java", "c", "cpp", "h", "hpp",
    "cs", "go", "rs", "rb", "php", "swift", "kt", "scala", "html", "css",
  ]);

  try {
    const { data: tree } = await octokit.rest.git.getTree({
      owner,
      repo,
      tree_sha: ref || "HEAD",
      recursive: "1",
    });

    const files = [];
    for (const item of tree.tree) {
      if (item.type !== "blob") continue;
      if (item.size > 100000) continue; // Skip very large files

      const ext = (item.path.split(".").pop() || "").toLowerCase();
      if (!codeExtensions.has(ext)) continue;

      // Skip common non-solution files
      if (
        item.path.includes("node_modules/") ||
        item.path.includes("package-lock.json") ||
        item.path.includes(".min.") ||
        item.path.includes("vendor/") ||
        item.path.includes("dist/")
      ) {
        continue;
      }

      try {
        const { data: blob } = await octokit.rest.git.getBlob({
          owner,
          repo,
          file_sha: item.sha,
        });
        const content = Buffer.from(blob.content, "base64").toString("utf8");
        files.push({ path: item.path, content });
      } catch {
        // Skip files we can't read
      }
    }

    return files;
  } catch (err) {
    logger.warn(`Failed to fetch repo tree ${owner}/${repo}: ${err.message}`);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Core: monitor a single participant's repository
// ---------------------------------------------------------------------------

/**
 * Fetch commits, analyse patterns, and persist results for one repo.
 *
 * @param {string} owner
 * @param {string} repo
 * @param {string} participantId – Mongoose ObjectId
 * @returns {Promise<object>} – the saved GitHubAnalysis document
 */
async function monitorRepository(owner, repo, participantId) {
  logger.info(`Monitoring repository ${owner}/${repo} for participant ${participantId}`);

  // Find or create analysis record
  let analysis = await GitHubAnalysis.findOne({ participantId });
  if (!analysis) {
    analysis = new GitHubAnalysis({
      participantId,
      repoOwner: owner,
      repoName: repo,
      repoFullName: `${owner}/${repo}`,
    });
  }

  // Fetch commits since last sync
  const since = analysis.lastProcessedSha
    ? analysis.lastSyncAt?.toISOString()
    : undefined;

  const rawCommits = await fetchCommits(owner, repo, since);

  if (rawCommits.length === 0) {
    logger.info(`No new commits for ${owner}/${repo}`);
    analysis.lastSyncAt = new Date();
    await analysis.save();
    return analysis;
  }

  // Fetch detail for each commit (rate-limit friendly: sequential)
  const commits = [];
  for (const rc of rawCommits) {
    // Skip if we already processed this SHA
    if (analysis.lastProcessedSha && rc.sha === analysis.lastProcessedSha) {
      break;
    }

    const detail = await fetchCommitDetail(owner, repo, rc.sha);
    commits.push({
      sha: rc.sha,
      message: rc.commit.message,
      date: rc.commit.author?.date || rc.commit.committer?.date,
      additions: detail.additions,
      deletions: detail.deletions,
      filesChanged: detail.filesChanged,
    });
  }

  if (commits.length === 0) {
    analysis.lastSyncAt = new Date();
    await analysis.save();
    return analysis;
  }

  // Sort oldest to newest
  commits.sort((a, b) => new Date(a.date) - new Date(b.date));

  // Run analysis
  const patternResult = analyzeCommitPattern(commits);
  const timingResult = analyzeTimingDistribution(commits);
  const statsResult = calculateCommitStats(commits);

  // Merge results (append to existing data for incremental updates)
  analysis.commitStats = statsResult;
  analysis.timingAnalysis = timingResult;
  analysis.suspiciousCommits = [
    ...analysis.suspiciousCommits,
    ...patternResult.suspiciousCommits,
  ].slice(-200); // Keep last 200
  analysis.burstCommits = [
    ...analysis.burstCommits,
    ...patternResult.burstCommits,
  ].slice(-100);
  analysis.avgCommitSuspicionScore = patternResult.avgScore;
  analysis.lastProcessedSha = commits[commits.length - 1].sha;
  analysis.lastSyncAt = new Date();

  // Recalculate overall suspicion
  analysis.recalculateSuspicion();
  await analysis.save();

  // Emit Socket.io update if available
  try {
    const io = require("../server").__io;
    if (io) {
      io.to("dashboard").emit("github:analysis:updated", {
        participantId,
        repo: `${owner}/${repo}`,
        githubSuspicionScore: analysis.githubSuspicionScore,
        newSuspiciousCommits: patternResult.suspiciousCommits.length,
      });
    }
  } catch {
    // Socket.io not available — that's fine
  }

  logger.info(
    `Analysis complete for ${owner}/${repo}: ` +
      `${commits.length} commits, score=${analysis.githubSuspicionScore}`
  );

  return analysis;
}

/**
 * Compare two repositories for code similarity.
 *
 * @param {{ owner: string, repo: string, participantId: string }} repo1
 * @param {{ owner: string, repo: string, participantId: string }} repo2
 * @param {number} [threshold=0.8]
 * @returns {Promise<object[]>} – array of similarity matches
 */
async function compareRepositories(repo1, repo2, threshold = 0.8) {
  logger.info(`Comparing ${repo1.owner}/${repo1.repo} vs ${repo2.owner}/${repo2.repo}`);

  const [files1, files2] = await Promise.all([
    fetchRepoFiles(repo1.owner, repo1.repo),
    fetchRepoFiles(repo2.owner, repo2.repo),
  ]);

  if (files1.length === 0 || files2.length === 0) {
    logger.info("One or both repos have no code files to compare");
    return [];
  }

  const repos = [
    { repoId: `${repo1.owner}/${repo1.repo}`, files: files1 },
    { repoId: `${repo2.owner}/${repo2.repo}`, files: files2 },
  ];

  const matches = crossCompareRepos(repos, threshold);

  // Persist similarity matches to both participants' analyses
  for (const match of matches) {
    // Update repo1's analysis
    await GitHubAnalysis.findOneAndUpdate(
      { participantId: repo1.participantId },
      {
        $push: {
          similarityMatches: {
            otherParticipantId: repo2.participantId,
            otherRepo: `${repo2.owner}/${repo2.repo}`,
            file1: match.file1,
            file2: match.file2,
            similarity: match.similarity,
            identicalContent: match.identicalContent,
          },
        },
        $max: { highestSimilarity: match.similarity },
      }
    );

    // Update repo2's analysis
    await GitHubAnalysis.findOneAndUpdate(
      { participantId: repo2.participantId },
      {
        $push: {
          similarityMatches: {
            otherParticipantId: repo1.participantId,
            otherRepo: `${repo1.owner}/${repo1.repo}`,
            file1: match.file2,
            file2: match.file1,
            similarity: match.similarity,
            identicalContent: match.identicalContent,
          },
        },
        $max: { highestSimilarity: match.similarity },
      }
    );
  }

  // Recalculate suspicion scores
  for (const pid of [repo1.participantId, repo2.participantId]) {
    const doc = await GitHubAnalysis.findOne({ participantId: pid });
    if (doc) {
      doc.recalculateSuspicion();
      await doc.save();
    }
  }

  return matches;
}

// ---------------------------------------------------------------------------
// API Routes (all require auth)
// ---------------------------------------------------------------------------

/**
 * GET /api/github/participant/:id/commits
 * List commits for a participant's monitored repo.
 */
router.get("/participant/:id/commits", requireAuth, async (req, res) => {
  try {
    const analysis = await GitHubAnalysis.findOne({
      participantId: req.params.id,
    });

    if (!analysis) {
      return res.status(404).json({ error: "No GitHub analysis found for this participant" });
    }

    // Fetch recent commits directly from GitHub
    const rawCommits = await fetchCommits(
      analysis.repoOwner,
      analysis.repoName
    );

    const commits = rawCommits.slice(0, 50).map((c) => ({
      sha: c.sha,
      message: c.commit.message,
      date: c.commit.author?.date || c.commit.committer?.date,
      author: c.commit.author?.name,
      url: c.html_url,
    }));

    res.json({
      repo: analysis.repoFullName,
      totalCommits: analysis.commitStats.totalCommits,
      commits,
    });
  } catch (err) {
    logger.error(`GET /github/participant/:id/commits error: ${err.message}`);
    res.status(500).json({ error: "Failed to fetch commits" });
  }
});

/**
 * GET /api/github/participant/:id/analysis
 * Get the full analysis for a participant.
 */
router.get("/participant/:id/analysis", requireAuth, async (req, res) => {
  try {
    const analysis = await GitHubAnalysis.findOne({
      participantId: req.params.id,
    }).populate("participantId", "machineId githubUsername");

    if (!analysis) {
      return res.status(404).json({ error: "No GitHub analysis found for this participant" });
    }

    res.json(analysis);
  } catch (err) {
    logger.error(`GET /github/participant/:id/analysis error: ${err.message}`);
    res.status(500).json({ error: "Failed to fetch analysis" });
  }
});

/**
 * POST /api/github/compare
 * Compare two participants' repos for plagiarism.
 * Body: { participantId1, participantId2, threshold? }
 */
router.post("/compare", requireAuth, async (req, res) => {
  try {
    const { participantId1, participantId2, threshold } = req.body;

    if (!participantId1 || !participantId2) {
      return res.status(400).json({ error: "Both participantId1 and participantId2 are required" });
    }

    const [a1, a2] = await Promise.all([
      GitHubAnalysis.findOne({ participantId: participantId1 }),
      GitHubAnalysis.findOne({ participantId: participantId2 }),
    ]);

    if (!a1 || !a2) {
      return res.status(404).json({ error: "GitHub analysis not found for one or both participants" });
    }

    const matches = await compareRepositories(
      {
        owner: a1.repoOwner,
        repo: a1.repoName,
        participantId: participantId1,
      },
      {
        owner: a2.repoOwner,
        repo: a2.repoName,
        participantId: participantId2,
      },
      threshold || 0.8
    );

    res.json({
      repo1: a1.repoFullName,
      repo2: a2.repoFullName,
      matchCount: matches.length,
      matches,
    });
  } catch (err) {
    logger.error(`POST /github/compare error: ${err.message}`);
    res.status(500).json({ error: "Failed to compare repositories" });
  }
});

/**
 * POST /api/github/register
 * Register a participant's GitHub repo for monitoring.
 * Body: { participantId, owner, repo }
 */
router.post("/register", requireAuth, async (req, res) => {
  try {
    const { participantId, owner, repo } = req.body;

    if (!participantId || !owner || !repo) {
      return res.status(400).json({ error: "participantId, owner, and repo are required" });
    }

    // Verify participant exists
    const participant = await Participant.findById(participantId);
    if (!participant) {
      return res.status(404).json({ error: "Participant not found" });
    }

    // Verify repo is accessible
    try {
      const octokit = getOctokit();
      await octokit.rest.repos.get({ owner, repo });
    } catch (err) {
      return res.status(400).json({ error: `Cannot access repository ${owner}/${repo}: ${err.message}` });
    }

    // Upsert analysis record
    const analysis = await GitHubAnalysis.findOneAndUpdate(
      { participantId },
      {
        participantId,
        repoOwner: owner,
        repoName: repo,
        repoFullName: `${owner}/${repo}`,
      },
      { upsert: true, new: true }
    );

    logger.info(`Registered repo ${owner}/${repo} for participant ${participantId}`);

    res.json({
      message: "Repository registered for monitoring",
      analysis: {
        id: analysis._id,
        repo: analysis.repoFullName,
        participantId: analysis.participantId,
      },
    });
  } catch (err) {
    logger.error(`POST /github/register error: ${err.message}`);
    res.status(500).json({ error: "Failed to register repository" });
  }
});

/**
 * POST /api/github/sync/:id
 * Manually trigger a sync for a specific participant.
 */
router.post("/sync/:id", requireAuth, async (req, res) => {
  try {
    const analysis = await GitHubAnalysis.findOne({
      participantId: req.params.id,
    });

    if (!analysis) {
      return res.status(404).json({ error: "No GitHub analysis found for this participant" });
    }

    const result = await monitorRepository(
      analysis.repoOwner,
      analysis.repoName,
      req.params.id
    );

    res.json({
      message: "Sync complete",
      repo: result.repoFullName,
      githubSuspicionScore: result.githubSuspicionScore,
      commitStats: result.commitStats,
    });
  } catch (err) {
    logger.error(`POST /github/sync/:id error: ${err.message}`);
    res.status(500).json({ error: "Failed to sync repository" });
  }
});

/**
 * GET /api/github/overview
 * Get an overview of all monitored repos and their suspicion scores.
 */
router.get("/overview", requireAuth, async (req, res) => {
  try {
    const analyses = await GitHubAnalysis.find()
      .populate("participantId", "machineId githubUsername")
      .sort({ githubSuspicionScore: -1 })
      .limit(50)
      .lean();

    const overview = analyses.map((a) => ({
      participantId: a.participantId?._id,
      githubUsername: a.participantId?.githubUsername,
      repo: a.repoFullName,
      githubSuspicionScore: a.githubSuspicionScore,
      highestSimilarity: a.highestSimilarity,
      totalCommits: a.commitStats?.totalCommits || 0,
      suspiciousCommitCount: (a.suspiciousCommits || []).length,
      burstCommitCount: (a.burstCommits || []).length,
      similarityMatchCount: (a.similarityMatches || []).length,
      lastSyncAt: a.lastSyncAt,
    }));

    res.json({ total: analyses.length, analyses: overview });
  } catch (err) {
    logger.error(`GET /github/overview error: ${err.message}`);
    res.status(500).json({ error: "Failed to fetch overview" });
  }
});

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = router;

// Also export functions so the cron job can use them
module.exports.monitorRepository = monitorRepository;
module.exports.compareRepositories = compareRepositories;
module.exports.fetchRepoFiles = fetchRepoFiles;
