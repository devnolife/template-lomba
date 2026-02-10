const mongoose = require("mongoose");

// ---------------------------------------------------------------------------
// Schema: GitHub Analysis
// ---------------------------------------------------------------------------
// Stores per-participant GitHub commit analysis results and cross-repo
// similarity comparisons.  Updated periodically by the cron sync job.
// ---------------------------------------------------------------------------

const suspiciousCommitSchema = new mongoose.Schema(
  {
    sha: String,
    message: String,
    date: Date,
    score: { type: Number, min: 0, max: 1 },
    reasons: [String],
  },
  { _id: false }
);

const burstCommitSchema = new mongoose.Schema(
  {
    sha: String,
    date: Date,
    intervalSeconds: Number,
  },
  { _id: false }
);

const idleBurstSchema = new mongoose.Schema(
  {
    idleStartedAt: Date,
    burstStartedAt: Date,
    idleDurationMin: Number,
    burstCommitCount: Number,
  },
  { _id: false }
);

const similarityMatchSchema = new mongoose.Schema(
  {
    otherParticipantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Participant",
    },
    otherRepo: String,
    file1: String,
    file2: String,
    similarity: { type: Number, min: 0, max: 1 },
    identicalContent: { type: Boolean, default: false },
    detectedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const githubAnalysisSchema = new mongoose.Schema(
  {
    participantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Participant",
      required: true,
      index: true,
    },

    // GitHub repo info
    repoOwner: { type: String, required: true },
    repoName: { type: String, required: true },
    repoFullName: { type: String, index: true }, // "owner/repo"
    defaultBranch: { type: String, default: "main" },

    // Commit stats (aggregate)
    commitStats: {
      totalCommits: { type: Number, default: 0 },
      totalAdditions: { type: Number, default: 0 },
      totalDeletions: { type: Number, default: 0 },
      totalFilesChanged: { type: Number, default: 0 },
      avgAdditionsPerCommit: { type: Number, default: 0 },
      avgDeletionsPerCommit: { type: Number, default: 0 },
      avgFilesPerCommit: { type: Number, default: 0 },
      avgIntervalMs: { type: Number, default: 0 },
      firstCommitDate: Date,
      lastCommitDate: Date,
    },

    // Timing analysis
    timingAnalysis: {
      hourlyDistribution: { type: [Number], default: () => new Array(24).fill(0) },
      idleBursts: [idleBurstSchema],
      totalGapMs: { type: Number, default: 0 },
    },

    // Suspicious commits
    suspiciousCommits: [suspiciousCommitSchema],
    burstCommits: [burstCommitSchema],
    avgCommitSuspicionScore: { type: Number, default: 0, min: 0, max: 1 },

    // Cross-repo similarity matches (plagiarism)
    similarityMatches: [similarityMatchSchema],
    highestSimilarity: { type: Number, default: 0, min: 0, max: 1 },

    // Overall GitHub-based suspicion score
    githubSuspicionScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 1,
      index: true,
    },

    // Last SHA we processed (to avoid re-fetching)
    lastProcessedSha: { type: String, default: "" },

    // Last sync timestamp
    lastSyncAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

// Compound index for quick lookups
githubAnalysisSchema.index({ repoOwner: 1, repoName: 1 }, { unique: true });

/**
 * Recalculate the overall GitHub suspicion score from sub-signals.
 */
githubAnalysisSchema.methods.recalculateSuspicion = function () {
  let score = 0;

  // Weight 1: commit pattern suspicion
  if (this.avgCommitSuspicionScore > 0) {
    score += this.avgCommitSuspicionScore * 0.35;
  }

  // Weight 2: idle-burst patterns
  const burstCount = (this.timingAnalysis.idleBursts || []).length;
  if (burstCount > 0) {
    score += Math.min(burstCount * 0.1, 0.25);
  }

  // Weight 3: similarity matches
  if (this.highestSimilarity > 0.8) {
    score += 0.4; // Very high weight for near-identical code
  } else if (this.highestSimilarity > 0.5) {
    score += this.highestSimilarity * 0.3;
  }

  this.githubSuspicionScore = Math.min(Math.round(score * 1000) / 1000, 1.0);
  return this.githubSuspicionScore;
};

module.exports = mongoose.model("GitHubAnalysis", githubAnalysisSchema);
