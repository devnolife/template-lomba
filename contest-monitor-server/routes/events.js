const express = require("express");
const router = express.Router();

const Participant = require("../models/Participant");
const Event = require("../models/Event");
const TypingPattern = require("../models/TypingPattern");
const {
  calculateEventSuspicion,
  calculateParticipantSuspicion,
  checkAlertConditions,
} = require("../utils/suspicionCalculator");
const { participantLimiter, validateEventsPayload } = require("../middleware/auth");
const logger = require("../utils/logger");

// ---------------------------------------------------------------------------
// POST /api/events — receive event batch from VS Code extension
// ---------------------------------------------------------------------------

router.post("/", participantLimiter, validateEventsPayload, async (req, res) => {
  try {
    const { events, typingPattern, participant } = req.body;
    const { machineId, workspace, sessionId } = participant;

    // ----- 1. Upsert participant ------------------------------------------
    let participantDoc = await Participant.findOneAndUpdate(
      { machineId },
      {
        $set: {
          workspaceName: workspace,
          sessionId,
          lastActive: new Date(),
        },
        $setOnInsert: {
          machineId,
          githubUsername: "",
          startTime: new Date(),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Try to extract githubUsername from the first event's workspace or
    // participant ID env var if we don't have one yet.
    if (!participantDoc.githubUsername && workspace && workspace !== "unknown") {
      participantDoc.githubUsername = workspace;
      await participantDoc.save();
    }

    // ----- 2. Count recent clipboard changes (for context) ----------------
    const sixtySecondsAgo = new Date(Date.now() - 60000);
    const recentClipboardCount = await Event.countDocuments({
      participantId: participantDoc._id,
      eventType: "clipboard",
      timestamp: { $gte: sixtySecondsAgo },
    });

    // Check if participant had typing events before (for file-create scoring)
    const hadTypingBefore =
      (await Event.countDocuments({
        participantId: participantDoc._id,
        eventType: { $in: ["typing", "file_change"] },
      })) > 0;

    const recentContext = {
      clipboardChanges60s: recentClipboardCount,
      hadTypingBefore,
    };

    // ----- 3. Score and save each event -----------------------------------
    const eventDocs = [];
    let batchMaxScore = 0;

    // Typing stats for scoring context
    const typingStats = {
      avgInterval: 0,
      variance: 0,
    };

    // Quick compute from this batch's typing pattern
    if (typingPattern.length > 0) {
      const intervals = typingPattern.map((t) => t.interval);
      const sum = intervals.reduce((a, b) => a + b, 0);
      typingStats.avgInterval = sum / intervals.length;
      const mean = typingStats.avgInterval;
      typingStats.variance =
        intervals.reduce((a, v) => a + Math.pow(v - mean, 2), 0) /
        intervals.length;
    }

    for (const event of events) {
      const { score, reasons } = calculateEventSuspicion(
        event,
        typingStats,
        recentContext
      );

      const flagged = score >= 0.5;
      if (score > batchMaxScore) batchMaxScore = score;

      eventDocs.push({
        participantId: participantDoc._id,
        eventType: event.type,
        timestamp: new Date(event.timestamp),
        data: event.data,
        userId: event.userId,
        workspace: event.workspace,
        suspicionScore: score,
        flagged,
      });

      // Update aggregate stats on participant
      switch (event.type) {
        case "paste":
          participantDoc.stats.pasteCount += 1;
          participantDoc.stats.pasteCharsTotal += event.data.length || 0;
          break;
        case "typing":
          if (event.data.anomaly) {
            participantDoc.stats.typingAnomalies += 1;
          }
          break;
        case "window_blur":
          if (event.data.focused === false) {
            participantDoc.stats.windowBlurCount += 1;
          }
          if (event.data.unfocusedDurationMs) {
            participantDoc.stats.windowBlurTotalMs +=
              event.data.unfocusedDurationMs;
          }
          break;
        case "clipboard":
          participantDoc.stats.clipboardChanges += 1;
          break;
        case "file_operation":
          if (event.data.operation === "create") {
            participantDoc.stats.filesCreated += 1;
          } else if (event.data.operation === "delete") {
            participantDoc.stats.filesDeleted += 1;
          }
          break;
      }
    }

    // Bulk insert events
    if (eventDocs.length > 0) {
      await Event.insertMany(eventDocs, { ordered: false });
    }

    // ----- 4. Update typing pattern ---------------------------------------
    if (typingPattern.length > 0) {
      const intervals = typingPattern.map((t) => t.interval);
      let patternDoc = await TypingPattern.findOne({
        participantId: participantDoc._id,
      });

      if (!patternDoc) {
        patternDoc = new TypingPattern({
          participantId: participantDoc._id,
          intervals: [],
        });
      }

      // Append new intervals, cap at 10 000
      patternDoc.intervals.push(...intervals);
      if (patternDoc.intervals.length > 10000) {
        patternDoc.intervals = patternDoc.intervals.slice(-8000);
      }
      patternDoc.recalculate();
      await patternDoc.save();
    }

    // ----- 5. Recalculate participant suspicion & save --------------------
    participantDoc.totalEvents += events.length;
    participantDoc.suspicionScore = calculateParticipantSuspicion(
      participantDoc.stats
    );
    participantDoc.lastActive = new Date();
    await participantDoc.save();

    // ----- 6. Check alert conditions & emit via Socket.io -----------------
    const alertCheck = checkAlertConditions(participantDoc);

    if (alertCheck.shouldAlert) {
      const io = req.app.get("io");
      if (io) {
        io.to("dashboard").emit("alert", {
          participantId: participantDoc._id,
          displayName: participantDoc.displayName,
          machineId: participantDoc.machineId,
          level: alertCheck.level,
          reasons: alertCheck.reasons,
          suspicionScore: participantDoc.suspicionScore,
          timestamp: new Date().toISOString(),
        });
      }
      logger.warn(
        `ALERT [${alertCheck.level}] ${participantDoc.displayName}: ${alertCheck.reasons.join(", ")}`
      );
    }

    // Emit live update to dashboard watchers
    const io = req.app.get("io");
    if (io) {
      io.to("dashboard").emit("participant:updated", {
        _id: participantDoc._id,
        displayName: participantDoc.displayName,
        suspicionScore: participantDoc.suspicionScore,
        lastActive: participantDoc.lastActive,
        totalEvents: participantDoc.totalEvents,
        stats: participantDoc.stats,
      });
    }

    logger.info(
      `Events received: ${events.length} from ${participantDoc.displayName} (score: ${participantDoc.suspicionScore})`
    );

    res.json({
      success: true,
      message: `Processed ${events.length} events`,
      participantScore: participantDoc.suspicionScore,
    });
  } catch (err) {
    logger.error(`POST /api/events error: ${err.message}`, { stack: err.stack });
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

module.exports = router;
