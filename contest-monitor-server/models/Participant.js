const mongoose = require("mongoose");

const participantSchema = new mongoose.Schema(
  {
    machineId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    githubUsername: {
      type: String,
      default: "",
      index: true,
    },
    workspaceName: {
      type: String,
      default: "unknown",
    },
    sessionId: {
      type: String,
      default: "",
    },
    startTime: {
      type: Date,
      default: Date.now,
    },
    lastActive: {
      type: Date,
      default: Date.now,
      index: true,
    },
    totalEvents: {
      type: Number,
      default: 0,
    },
    suspicionScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 1,
      index: true,
    },

    // Aggregate counters (updated on each event batch)
    stats: {
      pasteCount: { type: Number, default: 0 },
      pasteCharsTotal: { type: Number, default: 0 },
      typingAnomalies: { type: Number, default: 0 },
      windowBlurCount: { type: Number, default: 0 },
      windowBlurTotalMs: { type: Number, default: 0 },
      clipboardChanges: { type: Number, default: 0 },
      filesCreated: { type: Number, default: 0 },
      filesDeleted: { type: Number, default: 0 },
    },
  },
  {
    timestamps: true,
  }
);

// Virtual: human-readable display name
participantSchema.virtual("displayName").get(function () {
  return this.githubUsername || this.machineId.slice(0, 12);
});

participantSchema.set("toJSON", { virtuals: true });
participantSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Participant", participantSchema);
