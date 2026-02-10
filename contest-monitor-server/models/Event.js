const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema(
  {
    participantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Participant",
      required: true,
      index: true,
    },
    eventType: {
      type: String,
      required: true,
      enum: [
        "paste",
        "typing",
        "file_change",
        "file_operation",
        "window_blur",
        "clipboard",
      ],
      index: true,
    },
    timestamp: {
      type: Date,
      required: true,
      index: true,
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    suspicionScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 1,
    },
    flagged: {
      type: Boolean,
      default: false,
      index: true,
    },

    // Raw fields from extension payload
    userId: String,
    workspace: String,
  },
  {
    timestamps: true,
  }
);

// Compound index for timeline queries
eventSchema.index({ participantId: 1, timestamp: -1 });
eventSchema.index({ flagged: 1, suspicionScore: -1 });

module.exports = mongoose.model("Event", eventSchema);
