const cron = require("node-cron");
const logger = require("../utils/logger");
const GitHubAnalysis = require("../models/GitHubAnalysis");
const {
  monitorRepository,
  compareRepositories,
  fetchRepoFiles,
} = require("../routes/github-monitor");
const { crossCompareRepos } = require("../utils/similarity");

// ---------------------------------------------------------------------------
// GitHub Sync Cron Job
// ---------------------------------------------------------------------------
// Periodically:
//   1. Iterate all registered participant repos
//   2. Fetch new commits and analyse patterns
//   3. Run cross-repo similarity comparison for plagiarism detection
// ---------------------------------------------------------------------------

let _isRunning = false;
let _task = null;

/**
 * Run the full sync cycle once.
 */
async function runSync() {
  if (_isRunning) {
    logger.warn("GitHub sync already in progress — skipping this cycle");
    return;
  }

  _isRunning = true;
  const startTime = Date.now();
  logger.info("GitHub sync cycle started");

  try {
    // Step 1: Fetch all registered repos
    const analyses = await GitHubAnalysis.find().lean();

    if (analyses.length === 0) {
      logger.info("No repos registered for monitoring — nothing to sync");
      return;
    }

    logger.info(`Syncing ${analyses.length} registered repositories`);

    // Step 2: Monitor each repository (sequential to be friendly to rate limits)
    let successCount = 0;
    let errorCount = 0;

    for (const analysis of analyses) {
      try {
        await monitorRepository(
          analysis.repoOwner,
          analysis.repoName,
          analysis.participantId.toString()
        );
        successCount++;
      } catch (err) {
        errorCount++;
        logger.error(
          `Failed to sync ${analysis.repoOwner}/${analysis.repoName}: ${err.message}`
        );
      }
    }

    logger.info(
      `Commit analysis complete: ${successCount} succeeded, ${errorCount} failed`
    );

    // Step 3: Cross-repo similarity comparison (only if >=2 repos)
    if (analyses.length >= 2) {
      await runCrossComparison(analyses);
    }
  } catch (err) {
    logger.error(`GitHub sync cycle failed: ${err.message}`, {
      stack: err.stack,
    });
  } finally {
    _isRunning = false;
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    logger.info(`GitHub sync cycle finished in ${elapsed}s`);
  }
}

/**
 * Run pairwise similarity comparison across all registered repos.
 *
 * @param {object[]} analyses – array of GitHubAnalysis lean documents
 */
async function runCrossComparison(analyses) {
  logger.info(
    `Starting cross-repo comparison for ${analyses.length} repositories`
  );

  const threshold = parseFloat(process.env.SIMILARITY_THRESHOLD) || 0.8;

  // Fetch files from all repos
  const repoFiles = [];
  for (const a of analyses) {
    try {
      const files = await fetchRepoFiles(a.repoOwner, a.repoName);
      if (files.length > 0) {
        repoFiles.push({
          repoId: `${a.repoOwner}/${a.repoName}`,
          participantId: a.participantId.toString(),
          files,
        });
      }
    } catch (err) {
      logger.warn(
        `Failed to fetch files for ${a.repoOwner}/${a.repoName}: ${err.message}`
      );
    }
  }

  if (repoFiles.length < 2) {
    logger.info("Not enough repos with code files for comparison");
    return;
  }

  // Run Winnowing-based cross comparison
  const flags = crossCompareRepos(
    repoFiles.map((r) => ({ repoId: r.repoId, files: r.files })),
    threshold
  );

  if (flags.length === 0) {
    logger.info("No similarity matches above threshold");
    return;
  }

  logger.warn(`Found ${flags.length} similarity matches above ${threshold}`);

  // Build a lookup: repoId -> participantId
  const repoToParticipant = new Map();
  for (const r of repoFiles) {
    repoToParticipant.set(r.repoId, r.participantId);
  }

  // Persist matches
  for (const flag of flags) {
    const pid1 = repoToParticipant.get(flag.repo1);
    const pid2 = repoToParticipant.get(flag.repo2);

    if (!pid1 || !pid2) continue;

    // Update both participants' analysis docs
    const matchData1 = {
      otherParticipantId: pid2,
      otherRepo: flag.repo2,
      file1: flag.file1,
      file2: flag.file2,
      similarity: flag.similarity,
      identicalContent: flag.identicalContent,
    };

    const matchData2 = {
      otherParticipantId: pid1,
      otherRepo: flag.repo1,
      file1: flag.file2,
      file2: flag.file1,
      similarity: flag.similarity,
      identicalContent: flag.identicalContent,
    };

    await GitHubAnalysis.findOneAndUpdate(
      { participantId: pid1 },
      {
        $push: { similarityMatches: matchData1 },
        $max: { highestSimilarity: flag.similarity },
      }
    );

    await GitHubAnalysis.findOneAndUpdate(
      { participantId: pid2 },
      {
        $push: { similarityMatches: matchData2 },
        $max: { highestSimilarity: flag.similarity },
      }
    );
  }

  // Recalculate suspicion scores for affected participants
  const affectedPids = new Set();
  for (const flag of flags) {
    const pid1 = repoToParticipant.get(flag.repo1);
    const pid2 = repoToParticipant.get(flag.repo2);
    if (pid1) affectedPids.add(pid1);
    if (pid2) affectedPids.add(pid2);
  }

  for (const pid of affectedPids) {
    try {
      const doc = await GitHubAnalysis.findOne({ participantId: pid });
      if (doc) {
        doc.recalculateSuspicion();
        await doc.save();
      }
    } catch (err) {
      logger.error(
        `Failed to recalculate suspicion for ${pid}: ${err.message}`
      );
    }
  }
}

/**
 * Start the periodic sync cron job.
 *
 * @param {number} [intervalMinutes=5] – sync interval in minutes
 */
function startGitHubSync(intervalMinutes) {
  const interval = intervalMinutes || parseInt(process.env.GITHUB_SYNC_INTERVAL_MIN, 10) || 5;

  // Validate the interval produces a valid cron expression
  if (interval < 1 || interval > 60) {
    logger.error(`Invalid sync interval: ${interval} minutes. Must be 1-60.`);
    return;
  }

  const cronExpression = `*/${interval} * * * *`;

  // Validate cron expression before scheduling
  if (!cron.validate(cronExpression)) {
    logger.error(`Invalid cron expression: ${cronExpression}`);
    return;
  }

  logger.info(`Starting GitHub sync cron job every ${interval} minutes`);

  _task = cron.schedule(cronExpression, () => {
    runSync().catch((err) => {
      logger.error(`GitHub sync unhandled error: ${err.message}`);
    });
  });

  // Run once immediately on startup (after a short delay to let DB connect)
  setTimeout(() => {
    logger.info("Running initial GitHub sync on startup");
    runSync().catch((err) => {
      logger.error(`Initial GitHub sync failed: ${err.message}`);
    });
  }, 10000); // 10 second delay
}

/**
 * Stop the cron job (for graceful shutdown).
 */
function stopGitHubSync() {
  if (_task) {
    _task.stop();
    _task = null;
    logger.info("GitHub sync cron job stopped");
  }
}

module.exports = {
  startGitHubSync,
  stopGitHubSync,
  runSync,
};
