const logger = require("./logger");

// ---------------------------------------------------------------------------
// Commit pattern analysis for GitHub-based proctoring
// ---------------------------------------------------------------------------
// Detects suspicious patterns in a participant's git commit history:
//   - Burst commits (many commits in rapid succession)
//   - Unusually large commits with short messages
//   - Long idle periods followed by sudden activity
//   - Commits outside contest hours
// ---------------------------------------------------------------------------

/**
 * Minimum interval between commits (ms) to consider "burst".
 * Two commits less than 5 minutes apart are suspicious in a contest context.
 */
const BURST_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Threshold for "large commit" — more than N lines changed.
 */
const LARGE_COMMIT_LINES = 500;

/**
 * Minimum message length considered acceptable for a large commit.
 */
const SHORT_MESSAGE_MAX_LEN = 15;

/**
 * Long idle gap (ms) — if a participant is idle for this long then suddenly
 * produces a burst of commits, it's suspicious.
 */
const LONG_IDLE_MS = 30 * 60 * 1000; // 30 minutes

// ---------------------------------------------------------------------------
// Per-commit analysis
// ---------------------------------------------------------------------------

/**
 * Analyse a single commit for suspicious indicators.
 *
 * @param {object} commit
 * @param {string}  commit.sha
 * @param {string}  commit.message
 * @param {Date|string} commit.date
 * @param {number}  commit.additions
 * @param {number}  commit.deletions
 * @param {number}  commit.filesChanged
 * @param {object} [prevCommit]  – the immediately preceding commit (older)
 * @returns {{ score: number, reasons: string[] }}
 */
function detectSuspiciousCommit(commit, prevCommit = null) {
  let score = 0;
  const reasons = [];

  const totalLines = (commit.additions || 0) + (commit.deletions || 0);
  const msgLen = (commit.message || "").trim().length;

  // --- Large commit with short message ---
  if (totalLines > LARGE_COMMIT_LINES && msgLen < SHORT_MESSAGE_MAX_LEN) {
    score += 0.5;
    reasons.push(
      `large_commit_short_msg(${totalLines}lines,msg=${msgLen}chars)`
    );
  }

  // --- Very large single commit ---
  if (totalLines > 1000) {
    score += 0.3;
    reasons.push(`very_large_commit(${totalLines}lines)`);
  }

  // --- Burst commit (close to previous) ---
  if (prevCommit) {
    const interval =
      new Date(commit.date).getTime() - new Date(prevCommit.date).getTime();
    if (interval > 0 && interval < BURST_INTERVAL_MS) {
      score += 0.2;
      reasons.push(`burst_commit(${Math.round(interval / 1000)}s_apart)`);
    }
  }

  // --- Single-file commit with huge additions (possible paste of solution) ---
  if (
    commit.filesChanged === 1 &&
    commit.additions > 200 &&
    commit.deletions < 10
  ) {
    score += 0.4;
    reasons.push(
      `single_file_bulk_add(+${commit.additions}/-${commit.deletions})`
    );
  }

  score = Math.min(Math.round(score * 1000) / 1000, 1.0);
  return { score, reasons };
}

// ---------------------------------------------------------------------------
// Commit sequence analysis
// ---------------------------------------------------------------------------

/**
 * Analyse a chronologically ordered array of commits for suspicious patterns.
 *
 * @param {object[]} commits – array sorted oldest → newest, each with:
 *   { sha, message, date, additions, deletions, filesChanged }
 * @returns {{ burstCommits: object[], suspiciousCommits: object[], avgScore: number }}
 */
function analyzeCommitPattern(commits) {
  if (!commits || commits.length === 0) {
    return { burstCommits: [], suspiciousCommits: [], avgScore: 0 };
  }

  const burstCommits = [];
  const suspiciousCommits = [];
  let totalScore = 0;

  for (let i = 0; i < commits.length; i++) {
    const prev = i > 0 ? commits[i - 1] : null;
    const result = detectSuspiciousCommit(commits[i], prev);
    totalScore += result.score;

    if (result.score > 0) {
      suspiciousCommits.push({
        sha: commits[i].sha,
        message: commits[i].message,
        date: commits[i].date,
        score: result.score,
        reasons: result.reasons,
      });
    }

    // Track bursts separately
    if (prev) {
      const interval =
        new Date(commits[i].date).getTime() -
        new Date(prev.date).getTime();
      if (interval > 0 && interval < BURST_INTERVAL_MS) {
        burstCommits.push({
          sha: commits[i].sha,
          date: commits[i].date,
          intervalSeconds: Math.round(interval / 1000),
        });
      }
    }
  }

  const avgScore =
    commits.length > 0
      ? Math.round((totalScore / commits.length) * 1000) / 1000
      : 0;

  return { burstCommits, suspiciousCommits, avgScore };
}

// ---------------------------------------------------------------------------
// Timing distribution
// ---------------------------------------------------------------------------

/**
 * Group commits by hour-of-day and detect idle-then-burst patterns.
 *
 * @param {object[]} commits – sorted oldest → newest
 * @returns {{ hourlyDistribution: number[], idleBursts: object[], totalGapMs: number }}
 */
function analyzeTimingDistribution(commits) {
  // Hourly histogram (0-23)
  const hourlyDistribution = new Array(24).fill(0);
  const idleBursts = [];
  let totalGapMs = 0;

  for (let i = 0; i < commits.length; i++) {
    const dt = new Date(commits[i].date);
    hourlyDistribution[dt.getUTCHours()]++;

    if (i > 0) {
      const gap =
        new Date(commits[i].date).getTime() -
        new Date(commits[i - 1].date).getTime();
      totalGapMs += gap;

      // Detect idle-then-burst: long gap followed by rapid commits
      if (gap > LONG_IDLE_MS) {
        // Look ahead: how many commits follow within BURST_INTERVAL_MS?
        let burstCount = 1;
        for (let j = i + 1; j < commits.length; j++) {
          const nextGap =
            new Date(commits[j].date).getTime() -
            new Date(commits[j - 1].date).getTime();
          if (nextGap < BURST_INTERVAL_MS) {
            burstCount++;
          } else {
            break;
          }
        }

        if (burstCount >= 3) {
          idleBursts.push({
            idleStartedAt: commits[i - 1].date,
            burstStartedAt: commits[i].date,
            idleDurationMin: Math.round(gap / 60000),
            burstCommitCount: burstCount,
          });
        }
      }
    }
  }

  return { hourlyDistribution, idleBursts, totalGapMs };
}

// ---------------------------------------------------------------------------
// Aggregate stats
// ---------------------------------------------------------------------------

/**
 * Calculate aggregate commit statistics.
 *
 * @param {object[]} commits
 * @returns {object}
 */
function calculateCommitStats(commits) {
  if (!commits || commits.length === 0) {
    return {
      totalCommits: 0,
      totalAdditions: 0,
      totalDeletions: 0,
      totalFilesChanged: 0,
      avgAdditionsPerCommit: 0,
      avgDeletionsPerCommit: 0,
      avgFilesPerCommit: 0,
      avgIntervalMs: 0,
      firstCommitDate: null,
      lastCommitDate: null,
    };
  }

  let totalAdditions = 0;
  let totalDeletions = 0;
  let totalFilesChanged = 0;
  const intervals = [];

  for (let i = 0; i < commits.length; i++) {
    totalAdditions += commits[i].additions || 0;
    totalDeletions += commits[i].deletions || 0;
    totalFilesChanged += commits[i].filesChanged || 0;

    if (i > 0) {
      const interval =
        new Date(commits[i].date).getTime() -
        new Date(commits[i - 1].date).getTime();
      if (interval > 0) intervals.push(interval);
    }
  }

  const avgIntervalMs =
    intervals.length > 0
      ? Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length)
      : 0;

  return {
    totalCommits: commits.length,
    totalAdditions,
    totalDeletions,
    totalFilesChanged,
    avgAdditionsPerCommit: Math.round(totalAdditions / commits.length),
    avgDeletionsPerCommit: Math.round(totalDeletions / commits.length),
    avgFilesPerCommit: Math.round(totalFilesChanged / commits.length),
    avgIntervalMs,
    firstCommitDate: commits[0].date,
    lastCommitDate: commits[commits.length - 1].date,
  };
}

module.exports = {
  detectSuspiciousCommit,
  analyzeCommitPattern,
  analyzeTimingDistribution,
  calculateCommitStats,
  BURST_INTERVAL_MS,
  LARGE_COMMIT_LINES,
  LONG_IDLE_MS,
};
