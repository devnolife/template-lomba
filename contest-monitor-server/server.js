require("dotenv").config();

const express = require("express");
const http = require("http");
const { Server: SocketIO } = require("socket.io");
const helmet = require("helmet");
const cors = require("cors");

const { connectDatabase } = require("./config/database");
const { globalLimiter } = require("./middleware/auth");
const logger = require("./utils/logger");

// Routes
const eventsRouter = require("./routes/events");
const dashboardRouter = require("./routes/dashboard");
const alertsRouter = require("./routes/alerts");
const githubMonitorRouter = require("./routes/github-monitor");
const authRouter = require("./routes/auth");

// Cron
const { startGitHubSync, stopGitHubSync } = require("./cron/githubSync");

// ---------------------------------------------------------------------------
// App setup
// ---------------------------------------------------------------------------

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;

// ---------------------------------------------------------------------------
// Socket.io
// ---------------------------------------------------------------------------

const io = new SocketIO(server, {
  cors: {
    origin: process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(",").map((s) => s.trim())
      : ["http://localhost:3000", "http://localhost:5173"],
    methods: ["GET", "POST"],
  },
});

// Make io accessible in routes via req.app.get("io")
app.set("io", io);

io.on("connection", (socket) => {
  logger.info(`Socket connected: ${socket.id}`);

  // Dashboard clients join the "dashboard" room to receive live updates.
  socket.on("join:dashboard", () => {
    socket.join("dashboard");
    logger.info(`Socket ${socket.id} joined dashboard room`);
  });

  // Optionally watch a specific participant
  socket.on("watch:participant", (participantId) => {
    socket.join(`participant:${participantId}`);
    logger.info(`Socket ${socket.id} watching participant ${participantId}`);
  });

  socket.on("disconnect", () => {
    logger.debug(`Socket disconnected: ${socket.id}`);
  });
});

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

app.use(helmet());

// CORS — allow Codespaces domains + configured origins
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map((s) => s.trim())
  : [];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (curl, server-to-server)
      if (!origin) return callback(null, true);

      // Allow GitHub Codespaces domains
      if (
        origin.endsWith(".github.dev") ||
        origin.endsWith(".preview.app.github.dev") ||
        origin.endsWith(".app.github.dev") ||
        allowedOrigins.includes(origin) ||
        allowedOrigins.length === 0 // dev: allow all if none configured
      ) {
        return callback(null, true);
      }

      callback(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "2mb" }));
app.use(globalLimiter);

// Request logging
app.use((req, _res, next) => {
  logger.debug(`${req.method} ${req.path}`);
  next();
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

app.use("/api/events", eventsRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/alerts", alertsRouter);
app.use("/api/github", githubMonitorRouter);
app.use("/api/auth", authRouter);

// Health check
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// 404
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Global error handler
app.use((err, _req, res, _next) => {
  logger.error(`Unhandled error: ${err.message}`, { stack: err.stack });
  res.status(500).json({ error: "Internal server error" });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

async function start() {
  await connectDatabase();

  server.listen(PORT, () => {
    logger.info(`Contest Monitor Server running on port ${PORT}`);
    logger.info(`Socket.io ready`);
    logger.info(`Health check: http://localhost:${PORT}/health`);
  });

  // Start GitHub sync cron job (only if GITHUB_TOKEN is configured)
  if (process.env.GITHUB_TOKEN) {
    startGitHubSync();
  } else {
    logger.info("GITHUB_TOKEN not set — GitHub monitoring disabled");
  }
}

// Export io for use by other modules (e.g. github-monitor route)
module.exports.__io = io;

start().catch((err) => {
  logger.error(`Failed to start server: ${err.message}`);
  process.exit(1);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  logger.info("SIGTERM received — shutting down");
  stopGitHubSync();
  io.close();
  server.close();
  process.exit(0);
});

process.on("SIGINT", async () => {
  logger.info("SIGINT received — shutting down");
  stopGitHubSync();
  io.close();
  server.close();
  process.exit(0);
});
