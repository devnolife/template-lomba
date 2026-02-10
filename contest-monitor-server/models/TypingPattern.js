const mongoose = require("mongoose");

const typingPatternSchema = new mongoose.Schema(
  {
    participantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Participant",
      required: true,
      unique: true,
      index: true,
    },
    // Rolling window of recent intervals (ms between keystrokes)
    intervals: {
      type: [Number],
      default: [],
    },
    // Computed stats
    avgInterval: {
      type: Number,
      default: 0,
    },
    avgWPM: {
      type: Number,
      default: 0,
    },
    variance: {
      type: Number,
      default: 0,
    },
    stdDev: {
      type: Number,
      default: 0,
    },
    sampleCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Recalculate stats from the intervals array.
 */
typingPatternSchema.methods.recalculate = function () {
  const intervals = this.intervals;
  if (intervals.length === 0) {
    this.avgInterval = 0;
    this.avgWPM = 0;
    this.variance = 0;
    this.stdDev = 0;
    return;
  }

  const sum = intervals.reduce((a, b) => a + b, 0);
  const mean = sum / intervals.length;
  this.avgInterval = Math.round(mean * 100) / 100;

  // WPM: average word = 5 chars, interval is ms-per-char
  // chars-per-minute = 60000 / avgInterval
  // WPM = chars-per-minute / 5
  if (mean > 0) {
    this.avgWPM = Math.round((60000 / mean / 5) * 100) / 100;
  }

  const squareDiffs = intervals.map((v) => Math.pow(v - mean, 2));
  this.variance =
    Math.round(
      (squareDiffs.reduce((a, b) => a + b, 0) / intervals.length) * 100
    ) / 100;
  this.stdDev = Math.round(Math.sqrt(this.variance) * 100) / 100;

  this.sampleCount = intervals.length;
};

module.exports = mongoose.model("TypingPattern", typingPatternSchema);
