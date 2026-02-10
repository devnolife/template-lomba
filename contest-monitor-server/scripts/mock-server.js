#!/usr/bin/env node
/**
 * mock-server.js — Standalone mock API server with fake data (no MongoDB).
 *
 * Returns realistic fake data for all dashboard endpoints.
 * Perfect for frontend development without any database setup.
 *
 * Usage:
 *   node scripts/mock-server.js
 *   npm run dev:mock
 *
 * Login:
 *   username: admin
 *   password: admin123
 */

const express = require("express");
const http = require("http");
const { Server: SocketIO } = require("socket.io");
const cors = require("cors");
const jwt = require("jsonwebtoken");

const JWT_SECRET = "mock-secret-key";
const PORT = process.env.PORT || 3000;

// ---------------------------------------------------------------------------
// Fake data generation
// ---------------------------------------------------------------------------

function rand(min, max) { return Math.random() * (max - min) + min; }
function randInt(min, max) { return Math.floor(rand(min, max + 1)); }
function pick(arr) { return arr[randInt(0, arr.length - 1)]; }
function uuid() { return "xxxxxxxx-xxxx-4xxx-yxxx".replace(/[xy]/g, (c) => { const r = randInt(0, 15); return (c === "x" ? r : (r & 0x3) | 0x8).toString(16); }); }
function objectId() { return Array.from({ length: 24 }, () => randInt(0, 15).toString(16)).join(""); }
function hoursAgo(h) { return new Date(Date.now() - h * 3600000); }
function randomDate(maxHoursAgo = 4) { return new Date(Date.now() - rand(0, maxHoursAgo * 3600000)); }

const FILE_NAMES = [
  "index.js", "app.js", "utils.js", "helpers.js", "main.py", "server.js",
  "style.css", "index.html", "README.md", "package.json", "config.js",
  "database.js", "routes.js", "test.js", "component.jsx", "api.js",
];

const PROFILES = {
  clean: { scoreRange: [0, 0.15], pasteFreq: 0.02, blurFreq: 0.03, eventCount: [80, 200] },
  moderate: { scoreRange: [0.2, 0.45], pasteFreq: 0.08, blurFreq: 0.1, eventCount: [60, 150] },
  suspicious: { scoreRange: [0.5, 0.75], pasteFreq: 0.15, blurFreq: 0.2, eventCount: [40, 120] },
  flagged: { scoreRange: [0.75, 0.95], pasteFreq: 0.25, blurFreq: 0.3, eventCount: [30, 80] },
};

const PARTICIPANT_TEMPLATES = [
  { github: "ahmad_rizky", workspace: "web-calculator", profile: "clean" },
  { github: "siti_nurhaliza", workspace: "todo-app", profile: "clean" },
  { github: "budi_santoso", workspace: "weather-app", profile: "suspicious" },
  { github: "dewi_lestari", workspace: "chat-app", profile: "clean" },
  { github: "agus_pratama", workspace: "quiz-game", profile: "moderate" },
  { github: "rina_wati", workspace: "portfolio-site", profile: "clean" },
  { github: "hendra_wijaya", workspace: "e-commerce-mini", profile: "suspicious" },
  { github: "putri_ayu", workspace: "blog-engine", profile: "clean" },
  { github: "fajar_nugroho", workspace: "rest-api-crud", profile: "moderate" },
  { github: "maya_sari", workspace: "image-gallery", profile: "clean" },
  { github: "dani_setiawan", workspace: "markdown-editor", profile: "flagged" },
  { github: "lina_kusuma", workspace: "task-manager", profile: "clean" },
  { github: "reza_firmansyah", workspace: "social-feed", profile: "moderate" },
  { github: "anita_permata", workspace: "recipe-app", profile: "clean" },
  { github: "yoga_prasetyo", workspace: "expense-tracker", profile: "suspicious" },
  { github: "nadia_rahman", workspace: "music-player", profile: "clean" },
  { github: "irfan_hakim", workspace: "url-shortener", profile: "flagged" },
  { github: "tika_amelia", workspace: "note-taking", profile: "clean" },
  { github: "bayu_aditya", workspace: "dashboard-ui", profile: "moderate" },
  { github: "citra_dewi", workspace: "form-builder", profile: "clean" },
];

// ---------------------------------------------------------------------------
// Generate all fake data
// ---------------------------------------------------------------------------

const participants = [];
const allEvents = [];
const typingPatterns = [];
const githubAnalyses = [];

function generateAll() {
  for (const t of PARTICIPANT_TEMPLATES) {
    const cfg = PROFILES[t.profile];
    const id = objectId();
    const score = Math.round(rand(...cfg.scoreRange) * 1000) / 1000;
    const eventCount = randInt(...cfg.eventCount);

    const p = {
      _id: id,
      id: id,
      machineId: `codespace-${t.github}-${uuid()}`,
      githubUsername: t.github,
      displayName: t.github,
      workspaceName: t.workspace,
      sessionId: uuid(),
      startTime: hoursAgo(4).toISOString(),
      lastActive: randomDate(0.3).toISOString(),
      totalEvents: eventCount,
      suspicionScore: score,
      stats: {
        pasteCount: t.profile === "flagged" ? randInt(10, 30) : randInt(0, 5),
        pasteCharsTotal: t.profile === "flagged" ? randInt(5000, 20000) : randInt(0, 1000),
        typingAnomalies: t.profile === "flagged" ? randInt(5, 15) : randInt(0, 3),
        windowBlurCount: t.profile === "suspicious" ? randInt(10, 30) : randInt(0, 8),
        windowBlurTotalMs: t.profile === "suspicious" ? randInt(300000, 900000) : randInt(0, 120000),
        clipboardChanges: randInt(0, 10),
        filesCreated: randInt(3, 20),
        filesDeleted: randInt(0, 5),
      },
      createdAt: hoursAgo(4).toISOString(),
      updatedAt: randomDate(0.1).toISOString(),
    };

    participants.push(p);

    // Events
    for (let i = 0; i < eventCount; i++) {
      const r = Math.random();
      let eventType, data = {}, evScore = 0;

      if (r < cfg.pasteFreq) {
        eventType = "paste";
        const len = t.profile === "flagged" ? randInt(200, 2000) : randInt(10, 300);
        data = { length: len, fileName: pick(FILE_NAMES), preview: "const x = " + "a".repeat(Math.min(len, 40)) + "..." };
        evScore = len > 100 ? rand(0.4, 0.9) : rand(0.1, 0.3);
      } else if (r < cfg.pasteFreq + cfg.blurFreq) {
        eventType = "window_blur";
        const dur = t.profile === "flagged" ? randInt(60000, 300000) : randInt(2000, 60000);
        data = { focused: false, unfocusedDurationMs: dur };
        evScore = dur > 120000 ? rand(0.5, 0.8) : rand(0.05, 0.3);
      } else if (r < cfg.pasteFreq + cfg.blurFreq + 0.05) {
        eventType = "clipboard";
        data = { source: "external", length: randInt(20, 500) };
        evScore = rand(0.1, 0.4);
      } else if (r < cfg.pasteFreq + cfg.blurFreq + 0.1) {
        eventType = "file_operation";
        const op = pick(["create", "delete", "rename"]);
        data = { operation: op, fileName: pick(FILE_NAMES) };
        evScore = op === "delete" ? rand(0.1, 0.3) : rand(0, 0.1);
      } else if (r < cfg.pasteFreq + cfg.blurFreq + 0.3) {
        eventType = "file_change";
        data = { fileName: pick(FILE_NAMES), linesAdded: randInt(1, 30), linesRemoved: randInt(0, 10) };
        evScore = rand(0, 0.1);
      } else {
        eventType = "typing";
        data = { charCount: randInt(5, 100), wpm: t.profile === "clean" ? rand(30, 80) : rand(10, 150), anomaly: t.profile === "flagged" ? Math.random() > 0.5 : false };
        evScore = data.anomaly ? rand(0.3, 0.7) : rand(0, 0.1);
      }

      allEvents.push({
        _id: objectId(),
        participantId: id,
        eventType,
        timestamp: randomDate(4).toISOString(),
        data,
        suspicionScore: Math.round(evScore * 1000) / 1000,
        flagged: evScore >= 0.5,
        userId: id,
        workspace: t.workspace,
        createdAt: randomDate(4).toISOString(),
      });
    }

    // Typing pattern
    const baseInterval = t.profile === "clean" ? rand(80, 200) : rand(30, 400);
    const jitter = t.profile === "flagged" ? 150 : t.profile === "suspicious" ? 80 : 30;
    const intervals = Array.from({ length: randInt(200, 500) }, () => Math.max(10, baseInterval + rand(-jitter, jitter)));
    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((a, v) => a + Math.pow(v - mean, 2), 0) / intervals.length;

    typingPatterns.push({
      _id: objectId(),
      participantId: id,
      intervals: intervals.slice(0, 100), // only send a subset
      avgInterval: Math.round(mean * 100) / 100,
      avgWPM: mean > 0 ? Math.round((60000 / mean / 5) * 100) / 100 : 0,
      variance: Math.round(variance * 100) / 100,
      stdDev: Math.round(Math.sqrt(variance) * 100) / 100,
      sampleCount: intervals.length,
    });

    // GitHub analysis (80% chance)
    if (Math.random() > 0.2) {
      const totalCommits = randInt(5, 40);
      const hourly = new Array(24).fill(0);
      for (let i = 0; i < totalCommits; i++) {
        hourly[t.profile === "flagged" ? randInt(0, 23) : randInt(8, 17)]++;
      }

      githubAnalyses.push({
        _id: objectId(),
        participantId: id,
        repoOwner: t.github,
        repoName: "contest-submission",
        repoFullName: `${t.github}/contest-submission`,
        defaultBranch: "main",
        commitStats: {
          totalCommits,
          totalAdditions: randInt(100, 2000),
          totalDeletions: randInt(10, 500),
          totalFilesChanged: randInt(5, 50),
          avgAdditionsPerCommit: randInt(10, 100),
          avgDeletionsPerCommit: randInt(2, 30),
          avgFilesPerCommit: randInt(1, 5),
          avgIntervalMs: randInt(60000, 1800000),
          firstCommitDate: hoursAgo(4).toISOString(),
          lastCommitDate: randomDate(0.5).toISOString(),
        },
        timingAnalysis: {
          hourlyDistribution: hourly,
          idleBursts: t.profile === "flagged" || t.profile === "suspicious"
            ? [{ idleStartedAt: hoursAgo(3).toISOString(), burstStartedAt: hoursAgo(2).toISOString(), idleDurationMin: randInt(30, 120), burstCommitCount: randInt(5, 15) }]
            : [],
          totalGapMs: randInt(0, 3600000),
        },
        suspiciousCommits: t.profile === "flagged"
          ? [{ sha: objectId() + objectId().slice(0, 16), message: "Add all files", date: randomDate(1).toISOString(), score: rand(0.6, 0.95), reasons: ["Large single commit", "Outside contest hours", "Bulk file addition"] }]
          : [],
        burstCommits: ["suspicious", "flagged"].includes(t.profile)
          ? Array.from({ length: randInt(2, 5) }, () => ({ sha: objectId() + objectId().slice(0, 16), date: randomDate(2).toISOString(), intervalSeconds: randInt(5, 30) }))
          : [],
        avgCommitSuspicionScore: t.profile === "flagged" ? rand(0.5, 0.9) : t.profile === "suspicious" ? rand(0.2, 0.5) : rand(0, 0.15),
        similarityMatches: [],
        highestSimilarity: t.profile === "flagged" ? rand(0.7, 0.95) : 0,
        githubSuspicionScore: t.profile === "flagged" ? rand(0.6, 0.95) : t.profile === "suspicious" ? rand(0.3, 0.6) : rand(0, 0.2),
        lastSyncAt: new Date().toISOString(),
      });
    }
  }

  // Sort events by timestamp
  allEvents.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  // Add cross-participant similarity for flagged users
  const flagged = participants.filter((p) => p.suspicionScore >= 0.7);
  const suspicious = participants.filter((p) => p.suspicionScore >= 0.4 && p.suspicionScore < 0.7);
  for (const fp of flagged) {
    const ga = githubAnalyses.find((g) => g.participantId === fp._id);
    if (ga && suspicious.length > 0) {
      const other = pick(suspicious);
      ga.similarityMatches.push({
        otherParticipantId: other._id,
        otherRepo: `${other.githubUsername}/contest-submission`,
        file1: "index.js",
        file2: "index.js",
        similarity: Math.round(rand(0.75, 0.95) * 1000) / 1000,
        identicalContent: Math.random() > 0.5,
        detectedAt: new Date().toISOString(),
      });
    }
  }
}

generateAll();

// ---------------------------------------------------------------------------
// Auth middleware
// ---------------------------------------------------------------------------

function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    req.user = jwt.verify(auth.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

// ---------------------------------------------------------------------------
// Express app
// ---------------------------------------------------------------------------

const app = express();
const server = http.createServer(app);

const io = new SocketIO(server, {
  cors: { origin: ["http://localhost:3000", "http://localhost:5173"], methods: ["GET", "POST"] },
});

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "2mb" }));

// Request logging
app.use((req, _res, next) => {
  console.log(`  ${req.method} ${req.path}`);
  next();
});

// ---------------------------------------------------------------------------
// Socket.io
// ---------------------------------------------------------------------------

io.on("connection", (socket) => {
  console.log(`  Socket connected: ${socket.id}`);
  socket.on("join:dashboard", () => {
    socket.join("dashboard");
    console.log(`  Socket ${socket.id} joined dashboard`);
  });
  socket.on("watch:participant", (id) => {
    socket.join(`participant:${id}`);
  });
  socket.on("disconnect", () => {
    console.log(`  Socket disconnected: ${socket.id}`);
  });
});

// Simulate live events every 8-15 seconds
setInterval(() => {
  const p = pick(participants);
  const eventType = pick(["typing", "file_change", "paste", "window_blur"]);
  const score = eventType === "paste" ? rand(0.2, 0.7) : rand(0, 0.2);

  // Update participant lastActive
  p.lastActive = new Date().toISOString();
  p.totalEvents += 1;

  io.to("dashboard").emit("participant:updated", {
    _id: p._id,
    displayName: p.displayName,
    suspicionScore: p.suspicionScore,
    lastActive: p.lastActive,
    totalEvents: p.totalEvents,
    stats: p.stats,
  });

  // Occasionally emit an alert for suspicious participants
  if (p.suspicionScore > 0.6 && Math.random() > 0.7) {
    io.to("dashboard").emit("alert", {
      participantId: p._id,
      displayName: p.displayName,
      machineId: p.machineId,
      level: p.suspicionScore > 0.8 ? "critical" : "warning",
      reasons: [
        p.suspicionScore > 0.8 ? "Very high suspicion score" : "Elevated suspicion score",
        eventType === "paste" ? "Large paste detected" : "Unusual activity pattern",
      ],
      suspicionScore: p.suspicionScore,
      timestamp: new Date().toISOString(),
    });
  }
}, randInt(8000, 15000));

// ---------------------------------------------------------------------------
// Routes: Auth
// ---------------------------------------------------------------------------

app.post("/api/dashboard/login", (req, res) => {
  const { username, password } = req.body;
  if (username === "admin" && password === "admin123") {
    const token = jwt.sign({ id: "admin", username: "admin", role: "admin" }, JWT_SECRET, { expiresIn: "12h" });
    return res.json({ token, expiresIn: "12h" });
  }
  res.status(401).json({ error: "Invalid credentials" });
});

// ---------------------------------------------------------------------------
// Routes: Dashboard
// ---------------------------------------------------------------------------

app.get("/api/dashboard/participants", requireAuth, (req, res) => {
  const { sort = "suspicionScore", order = "desc", limit = 50, offset = 0 } = req.query;
  const dir = order === "asc" ? 1 : -1;
  const sorted = [...participants].sort((a, b) => {
    const va = a[sort] ?? 0;
    const vb = b[sort] ?? 0;
    return (va < vb ? -1 : va > vb ? 1 : 0) * dir;
  });
  const sliced = sorted.slice(Number(offset), Number(offset) + Number(limit));
  res.json({ participants: sliced, total: participants.length, limit: Number(limit), offset: Number(offset) });
});

app.get("/api/dashboard/participant/:id", requireAuth, (req, res) => {
  const p = participants.find((x) => x._id === req.params.id);
  if (!p) return res.status(404).json({ error: "Participant not found" });

  const { eventsLimit = 100, eventsOffset = 0, eventType, flaggedOnly } = req.query;
  let events = allEvents.filter((e) => e.participantId === p._id);
  if (eventType) events = events.filter((e) => e.eventType === eventType);
  if (flaggedOnly === "true") events = events.filter((e) => e.flagged);

  // Sort newest first
  events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  const eventCount = events.length;
  const sliced = events.slice(Number(eventsOffset), Number(eventsOffset) + Number(eventsLimit));

  const tp = typingPatterns.find((x) => x.participantId === p._id) || null;

  // Suspicion breakdown
  const breakdown = {};
  for (const ev of allEvents.filter((e) => e.participantId === p._id)) {
    const key = `${ev.eventType}_${ev.flagged}`;
    if (!breakdown[key]) breakdown[key] = { _id: { eventType: ev.eventType, flagged: ev.flagged }, count: 0, avgScore: 0, maxScore: 0, totalScore: 0 };
    breakdown[key].count++;
    breakdown[key].totalScore += ev.suspicionScore;
    if (ev.suspicionScore > breakdown[key].maxScore) breakdown[key].maxScore = ev.suspicionScore;
  }
  const suspicionBreakdown = Object.values(breakdown).map((b) => ({
    _id: b._id,
    count: b.count,
    avgScore: Math.round((b.totalScore / b.count) * 1000) / 1000,
    maxScore: Math.round(b.maxScore * 1000) / 1000,
  }));

  res.json({ participant: p, events: sliced, eventCount, typingPattern: tp, suspicionBreakdown });
});

// ---------------------------------------------------------------------------
// Routes: Analytics
// ---------------------------------------------------------------------------

app.get("/api/dashboard/analytics/suspicious", requireAuth, (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 10, 50);
  const suspicious = [...participants]
    .filter((p) => p.suspicionScore > 0)
    .sort((a, b) => b.suspicionScore - a.suspicionScore)
    .slice(0, limit)
    .map((p) => ({
      ...p,
      flaggedEventCount: allEvents.filter((e) => e.participantId === p._id && e.flagged).length,
    }));
  res.json({ suspicious, total: suspicious.length });
});

app.get("/api/dashboard/analytics/overview", requireAuth, (req, res) => {
  const fiveMinAgo = Date.now() - 5 * 60000;
  const active = participants.filter((p) => new Date(p.lastActive).getTime() >= fiveMinAgo).length;
  const flaggedEvents = allEvents.filter((e) => e.flagged).length;
  const avgScore = participants.reduce((s, p) => s + p.suspicionScore, 0) / participants.length;
  res.json({
    totalParticipants: participants.length,
    activeParticipants: active,
    totalEvents: allEvents.length,
    flaggedEvents,
    avgSuspicionScore: Math.round(avgScore * 1000) / 1000,
  });
});

// ---------------------------------------------------------------------------
// Routes: GitHub
// ---------------------------------------------------------------------------

app.get("/api/github/participant/:participantId/analysis", requireAuth, (req, res) => {
  const ga = githubAnalyses.find((g) => g.participantId === req.params.participantId);
  if (!ga) return res.status(404).json({ error: "No GitHub analysis found" });
  res.json(ga);
});

app.get("/api/github/participant/:participantId/commits", requireAuth, (req, res) => {
  const ga = githubAnalyses.find((g) => g.participantId === req.params.participantId);
  if (!ga) return res.json({ commits: [], total: 0 });
  // Generate fake commit list
  const commits = Array.from({ length: ga.commitStats.totalCommits }, (_, i) => ({
    sha: objectId() + objectId().slice(0, 16),
    message: pick(["Add feature", "Fix bug", "Update styles", "Refactor code", "Initial commit", "Add tests", "Update README", "Fix typo", "Add validation", "Implement API"]),
    date: randomDate(4).toISOString(),
    additions: randInt(5, 200),
    deletions: randInt(0, 50),
    filesChanged: randInt(1, 8),
  }));
  commits.sort((a, b) => new Date(b.date) - new Date(a.date));
  res.json({ commits, total: commits.length });
});

app.get("/api/github/overview", requireAuth, (req, res) => {
  res.json({
    totalRepos: githubAnalyses.length,
    totalCommits: githubAnalyses.reduce((s, g) => s + g.commitStats.totalCommits, 0),
    avgSuspicion: Math.round((githubAnalyses.reduce((s, g) => s + g.githubSuspicionScore, 0) / Math.max(githubAnalyses.length, 1)) * 1000) / 1000,
    highRiskCount: githubAnalyses.filter((g) => g.githubSuspicionScore > 0.5).length,
  });
});

app.post("/api/github/compare", requireAuth, (req, res) => {
  const { participantId1, participantId2 } = req.body;
  res.json({
    similarity: Math.round(rand(0.1, 0.8) * 1000) / 1000,
    participant1: participantId1,
    participant2: participantId2,
    commonFiles: randInt(1, 5),
    details: [{ file: "index.js", similarity: Math.round(rand(0.2, 0.9) * 1000) / 1000 }],
  });
});

app.post("/api/github/sync/:participantId", requireAuth, (req, res) => {
  res.json({ success: true, message: "Sync triggered (mock)" });
});

// ---------------------------------------------------------------------------
// Routes: Alerts
// ---------------------------------------------------------------------------

app.post("/api/alerts", requireAuth, (req, res) => {
  const alert = req.body;
  alert.timestamp = alert.timestamp || new Date().toISOString();
  io.to("dashboard").emit("alert", alert);
  res.json({ success: true, results: { slack: { sent: false }, discord: { sent: false }, email: { sent: false } } });
});

// ---------------------------------------------------------------------------
// Routes: Events (extension upload endpoint)
// ---------------------------------------------------------------------------

app.post("/api/events", (req, res) => {
  res.json({ success: true, message: "Events received (mock)", participantScore: rand(0, 0.5) });
});

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

app.get("/health", (_req, res) => {
  res.json({ status: "ok", mode: "mock", uptime: process.uptime(), timestamp: new Date().toISOString() });
});

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

server.listen(PORT, () => {
  console.log(`
  ==========================================
   Contest Monitor — MOCK SERVER
  ==========================================
   URL       : http://localhost:${PORT}
   Health    : http://localhost:${PORT}/health
   Mode      : In-memory fake data (no DB)
  ------------------------------------------
   Login     : admin / admin123
  ------------------------------------------
   Data:
     Participants : ${participants.length}
     Events       : ${allEvents.length} (${allEvents.filter((e) => e.flagged).length} flagged)
     GitHub repos : ${githubAnalyses.length}
   Profiles:
     Clean(10) Moderate(4) Suspicious(3) Flagged(2)
  ------------------------------------------
   Live events broadcast every 8-15 seconds
  ==========================================
`);
});
