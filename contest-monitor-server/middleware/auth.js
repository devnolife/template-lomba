const jwt = require("jsonwebtoken");
const Joi = require("joi");
const rateLimit = require("express-rate-limit");
const logger = require("../utils/logger");

const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-production";

// ---------------------------------------------------------------------------
// JWT middleware — protects dashboard / admin routes
// ---------------------------------------------------------------------------

function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid Authorization header" });
    }

    const token = header.slice(7);
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id, username, role }
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token expired" });
    }
    return res.status(401).json({ error: "Invalid token" });
  }
}

/**
 * Generate a JWT for an admin user.
 * @param {{ id: string, username: string, role: string }} payload
 * @returns {string}
 */
function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "12h" });
}

// ---------------------------------------------------------------------------
// Rate limiters
// ---------------------------------------------------------------------------

/** Per-participant rate limiter for POST /api/events */
const participantLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Key by machineId from the payload, fall back to IP
    const machineId = req.body?.participant?.machineId;
    return machineId || req.ip;
  },
  handler: (_req, res) => {
    res.status(429).json({ error: "Rate limit exceeded — max 100 req/min per participant" });
  },
});

/** Global rate limiter */
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({ error: "Global rate limit exceeded — max 1000 req/min" });
  },
});

// ---------------------------------------------------------------------------
// Joi validation schemas
// ---------------------------------------------------------------------------

const eventDataSchema = Joi.object({
  length: Joi.number().optional(),
  interval: Joi.number().optional(),
  file: Joi.string().max(500).optional(),
  focused: Joi.boolean().optional(),
  hash: Joi.string().max(128).optional(),
  elapsed: Joi.number().optional(),
  anomaly: Joi.string().max(50).optional(),
  insertedLength: Joi.number().optional(),
  deletedLength: Joi.number().optional(),
  lineCount: Joi.number().optional(),
  operation: Joi.string().max(20).optional(),
  from: Joi.string().max(500).optional(),
  to: Joi.string().max(500).optional(),
  unfocusedDurationMs: Joi.number().optional(),
  alert: Joi.boolean().optional(),
  source: Joi.string().max(20).optional(),
}).unknown(true);

const singleEventSchema = Joi.object({
  type: Joi.string()
    .valid("paste", "typing", "file_change", "file_operation", "window_blur", "clipboard")
    .required(),
  timestamp: Joi.number().required(),
  data: eventDataSchema.required(),
  userId: Joi.string().max(200).required(),
  workspace: Joi.string().max(200).required(),
});

const eventsPayloadSchema = Joi.object({
  events: Joi.array().items(singleEventSchema).max(500).required(),
  typingPattern: Joi.array()
    .items(
      Joi.object({
        timestamp: Joi.number().required(),
        interval: Joi.number().required(),
      })
    )
    .max(5000)
    .default([]),
  participant: Joi.object({
    machineId: Joi.string().max(200).required(),
    workspace: Joi.string().max(200).default("unknown"),
    sessionId: Joi.string().max(200).default(""),
  }).required(),
});

/**
 * Express middleware that validates request body against the events payload schema.
 */
function validateEventsPayload(req, res, next) {
  const { error, value } = eventsPayloadSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const messages = error.details.map((d) => d.message);
    logger.warn(`Validation failed: ${messages.join("; ")}`);
    return res.status(400).json({ error: "Validation failed", details: messages });
  }

  req.body = value;
  next();
}

// Login schema
const loginSchema = Joi.object({
  username: Joi.string().min(3).max(50).required(),
  password: Joi.string().min(6).max(128).required(),
});

function validateLogin(req, res, next) {
  const { error, value } = loginSchema.validate(req.body, { stripUnknown: true });
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }
  req.body = value;
  next();
}

module.exports = {
  requireAuth,
  generateToken,
  participantLimiter,
  globalLimiter,
  validateEventsPayload,
  validateLogin,
  JWT_SECRET,
};
