const express = require("express");
const bcrypt = require("bcryptjs");
const router = express.Router();

const Participant = require("../models/Participant");
const Event = require("../models/Event");
const TypingPattern = require("../models/TypingPattern");
const { requireAuth, generateToken, validateLogin } = require("../middleware/auth");
const logger = require("../utils/logger");

// ---------------------------------------------------------------------------
// POST /api/dashboard/login — admin login
// ---------------------------------------------------------------------------

router.post("/login", validateLogin, async (req, res) => {
  try {
    const { username, password } = req.body;

    // Simple admin credentials from env (for production, use a User model).
    const adminUser = process.env.ADMIN_USERNAME || "admin";
    const adminHash =
      process.env.ADMIN_PASSWORD_HASH ||
      // Default password: "contestadmin2024" — CHANGE IN PRODUCTION
      "$2a$10$X7UrE5Y5L5F5vKqK5Q5Zku5Y5L5F5vKqK5Q5Zku5Y5L5F5vKqK5Q";

    if (username !== adminUser) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // If ADMIN_PASSWORD is set as plaintext (convenience for dev), compare directly.
    const adminPlain = process.env.ADMIN_PASSWORD;
    let valid = false;

    if (adminPlain) {
      valid = password === adminPlain;
    } else {
      valid = await bcrypt.compare(password, adminHash);
    }

    if (!valid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = generateToken({
      id: "admin",
      username: adminUser,
      role: "admin",
    });

    res.json({ token, expiresIn: "12h" });
  } catch (err) {
    logger.error(`Login error: ${err.message}`);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/dashboard/participants — list all participants with summary
// ---------------------------------------------------------------------------

router.get("/participants", requireAuth, async (req, res) => {
  try {
    const {
      sort = "suspicionScore",
      order = "desc",
      limit = 50,
      offset = 0,
    } = req.query;

    const sortDir = order === "asc" ? 1 : -1;
    const sortField = ["suspicionScore", "lastActive", "totalEvents", "createdAt"].includes(sort)
      ? sort
      : "suspicionScore";

    const [participants, total] = await Promise.all([
      Participant.find()
        .sort({ [sortField]: sortDir })
        .skip(Number(offset))
        .limit(Number(limit))
        .lean(),
      Participant.countDocuments(),
    ]);

    res.json({
      participants,
      total,
      limit: Number(limit),
      offset: Number(offset),
    });
  } catch (err) {
    logger.error(`GET /participants error: ${err.message}`);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/dashboard/participant/:id — detail view for one participant
// ---------------------------------------------------------------------------

router.get("/participant/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      eventsLimit = 100,
      eventsOffset = 0,
      eventType,
      flaggedOnly,
    } = req.query;

    const participant = await Participant.findById(id).lean();
    if (!participant) {
      return res.status(404).json({ error: "Participant not found" });
    }

    // Build event query
    const eventQuery = { participantId: id };
    if (eventType) eventQuery.eventType = eventType;
    if (flaggedOnly === "true") eventQuery.flagged = true;

    const [events, eventCount, typingPattern] = await Promise.all([
      Event.find(eventQuery)
        .sort({ timestamp: -1 })
        .skip(Number(eventsOffset))
        .limit(Number(eventsLimit))
        .lean(),
      Event.countDocuments(eventQuery),
      TypingPattern.findOne({ participantId: id }).lean(),
    ]);

    // Suspicion breakdown — count events by type and flagged status
    const suspicionBreakdown = await Event.aggregate([
      { $match: { participantId: participant._id } },
      {
        $group: {
          _id: { eventType: "$eventType", flagged: "$flagged" },
          count: { $sum: 1 },
          avgScore: { $avg: "$suspicionScore" },
          maxScore: { $max: "$suspicionScore" },
        },
      },
      { $sort: { "_id.eventType": 1 } },
    ]);

    res.json({
      participant,
      events,
      eventCount,
      typingPattern,
      suspicionBreakdown,
    });
  } catch (err) {
    logger.error(`GET /participant/:id error: ${err.message}`);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/analytics/suspicious — top suspicious participants
// ---------------------------------------------------------------------------

router.get("/analytics/suspicious", requireAuth, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 10, 50);

    const participants = await Participant.find({ suspicionScore: { $gt: 0 } })
      .sort({ suspicionScore: -1 })
      .limit(limit)
      .lean();

    // Enrich each participant with recent flagged event count
    const enriched = await Promise.all(
      participants.map(async (p) => {
        const flaggedCount = await Event.countDocuments({
          participantId: p._id,
          flagged: true,
        });

        return {
          ...p,
          flaggedEventCount: flaggedCount,
        };
      })
    );

    res.json({ suspicious: enriched, total: enriched.length });
  } catch (err) {
    logger.error(`GET /analytics/suspicious error: ${err.message}`);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/analytics/overview — contest-wide stats
// ---------------------------------------------------------------------------

router.get("/analytics/overview", requireAuth, async (req, res) => {
  try {
    const [
      totalParticipants,
      activeParticipants,
      totalEvents,
      flaggedEvents,
      avgSuspicion,
    ] = await Promise.all([
      Participant.countDocuments(),
      Participant.countDocuments({
        lastActive: { $gte: new Date(Date.now() - 5 * 60 * 1000) },
      }),
      Event.countDocuments(),
      Event.countDocuments({ flagged: true }),
      Participant.aggregate([
        { $group: { _id: null, avg: { $avg: "$suspicionScore" } } },
      ]),
    ]);

    res.json({
      totalParticipants,
      activeParticipants,
      totalEvents,
      flaggedEvents,
      avgSuspicionScore: avgSuspicion[0]?.avg || 0,
    });
  } catch (err) {
    logger.error(`GET /analytics/overview error: ${err.message}`);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
