#!/usr/bin/env node
/**
 * seed-fake-data.js — Generate realistic fake data for development.
 *
 * This script populates MongoDB with:
 *   - 20 participants (varying suspicion levels)
 *   - ~50-200 events per participant
 *   - Typing patterns for each
 *   - GitHub analysis for some
 *
 * Usage: node scripts/seed-fake-data.js
 * (Called automatically by dev:mock script)
 */

const mongoose = require("mongoose");
const Participant = require("../models/Participant");
const Event = require("../models/Event");
const TypingPattern = require("../models/TypingPattern");
const GitHubAnalysis = require("../models/GitHubAnalysis");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function randInt(min, max) {
  return Math.floor(rand(min, max + 1));
}

function pick(arr) {
  return arr[randInt(0, arr.length - 1)];
}

function randomDate(hoursAgo = 4) {
  const now = Date.now();
  return new Date(now - rand(0, hoursAgo * 60 * 60 * 1000));
}

function uuid() {
  return "xxxxxxxx-xxxx-4xxx".replace(/x/g, () =>
    randInt(0, 15).toString(16)
  );
}

// ---------------------------------------------------------------------------
// Participant templates
// ---------------------------------------------------------------------------

const PARTICIPANTS = [
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

// Profile -> suspicion range & behavior
const PROFILES = {
  clean: { scoreRange: [0, 0.15], pasteFreq: 0.02, blurFreq: 0.03, eventCount: [80, 200] },
  moderate: { scoreRange: [0.2, 0.45], pasteFreq: 0.08, blurFreq: 0.1, eventCount: [60, 150] },
  suspicious: { scoreRange: [0.5, 0.75], pasteFreq: 0.15, blurFreq: 0.2, eventCount: [40, 120] },
  flagged: { scoreRange: [0.75, 0.95], pasteFreq: 0.25, blurFreq: 0.3, eventCount: [30, 80] },
};

const EVENT_TYPES = ["paste", "typing", "file_change", "file_operation", "window_blur", "clipboard"];
const FILE_NAMES = [
  "index.js", "app.js", "utils.js", "helpers.js", "main.py", "server.js",
  "style.css", "index.html", "README.md", "package.json", "config.js",
  "database.js", "routes.js", "test.js", "component.jsx",
];

// ---------------------------------------------------------------------------
// Generate events for a participant
// ---------------------------------------------------------------------------

function generateEvents(participantId, profile) {
  const config = PROFILES[profile];
  const count = randInt(...config.eventCount);
  const events = [];

  for (let i = 0; i < count; i++) {
    const r = Math.random();
    let eventType;
    let data = {};
    let score = 0;
    let flagged = false;

    if (r < config.pasteFreq) {
      eventType = "paste";
      const charCount = profile === "flagged" ? randInt(200, 2000) : randInt(10, 300);
      data = {
        length: charCount,
        fileName: pick(FILE_NAMES),
        preview: "const " + "x".repeat(Math.min(charCount, 50)) + "...",
      };
      score = charCount > 100 ? rand(0.4, 0.9) : rand(0.1, 0.3);
    } else if (r < config.pasteFreq + config.blurFreq) {
      eventType = "window_blur";
      const durationMs = profile === "flagged"
        ? randInt(60000, 300000)
        : randInt(2000, 60000);
      data = {
        focused: false,
        unfocusedDurationMs: durationMs,
      };
      score = durationMs > 120000 ? rand(0.5, 0.8) : rand(0.05, 0.3);
    } else if (r < config.pasteFreq + config.blurFreq + 0.05) {
      eventType = "clipboard";
      data = { source: "external", length: randInt(20, 500) };
      score = rand(0.1, 0.4);
    } else if (r < config.pasteFreq + config.blurFreq + 0.1) {
      eventType = "file_operation";
      const op = pick(["create", "delete", "rename"]);
      data = {
        operation: op,
        fileName: pick(FILE_NAMES),
      };
      score = op === "delete" ? rand(0.1, 0.3) : rand(0, 0.1);
    } else if (r < config.pasteFreq + config.blurFreq + 0.3) {
      eventType = "file_change";
      data = {
        fileName: pick(FILE_NAMES),
        linesAdded: randInt(1, 30),
        linesRemoved: randInt(0, 10),
      };
      score = rand(0, 0.1);
    } else {
      eventType = "typing";
      data = {
        charCount: randInt(5, 100),
        wpm: profile === "clean" ? rand(30, 80) : rand(10, 150),
        anomaly: profile === "flagged" ? Math.random() > 0.5 : false,
      };
      score = data.anomaly ? rand(0.3, 0.7) : rand(0, 0.1);
    }

    flagged = score >= 0.5;

    events.push({
      participantId,
      eventType,
      timestamp: randomDate(4),
      data,
      suspicionScore: Math.round(score * 1000) / 1000,
      flagged,
      userId: participantId.toString(),
      workspace: "contest-workspace",
    });
  }

  // Sort by timestamp
  events.sort((a, b) => a.timestamp - b.timestamp);
  return events;
}

// ---------------------------------------------------------------------------
// Generate typing pattern
// ---------------------------------------------------------------------------

function generateTypingPattern(participantId, profile) {
  const count = randInt(200, 1000);
  const intervals = [];

  // Clean typists have consistent intervals, suspicious have erratic
  const baseInterval = profile === "clean" ? rand(80, 200) : rand(30, 400);
  const jitter = profile === "flagged" ? 150 : profile === "suspicious" ? 80 : 30;

  for (let i = 0; i < count; i++) {
    intervals.push(Math.max(10, baseInterval + rand(-jitter, jitter)));
  }

  const sum = intervals.reduce((a, b) => a + b, 0);
  const mean = sum / intervals.length;
  const variance =
    intervals.reduce((a, v) => a + Math.pow(v - mean, 2), 0) / intervals.length;

  return {
    participantId,
    intervals: intervals.slice(-2000), // cap
    avgInterval: Math.round(mean * 100) / 100,
    avgWPM: mean > 0 ? Math.round((60000 / mean / 5) * 100) / 100 : 0,
    variance: Math.round(variance * 100) / 100,
    stdDev: Math.round(Math.sqrt(variance) * 100) / 100,
    sampleCount: count,
  };
}

// ---------------------------------------------------------------------------
// Generate GitHub analysis
// ---------------------------------------------------------------------------

function generateGitHubAnalysis(participantId, github, profile) {
  const totalCommits = randInt(5, 40);
  const hourly = new Array(24).fill(0);
  // Realistic: mostly active between 8-17
  for (let i = 0; i < totalCommits; i++) {
    const hour = profile === "flagged"
      ? randInt(0, 23) // flagged: commits at weird hours
      : randInt(8, 17); // normal contest hours
    hourly[hour]++;
  }

  const analysis = {
    participantId,
    repoOwner: github,
    repoName: "contest-submission",
    repoFullName: `${github}/contest-submission`,
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
      firstCommitDate: randomDate(4),
      lastCommitDate: randomDate(0.5),
    },
    timingAnalysis: {
      hourlyDistribution: hourly,
      idleBursts: profile === "flagged" || profile === "suspicious"
        ? [{
          idleStartedAt: randomDate(3),
          burstStartedAt: randomDate(2),
          idleDurationMin: randInt(30, 120),
          burstCommitCount: randInt(5, 15),
        }]
        : [],
      totalGapMs: randInt(0, 3600000),
    },
    suspiciousCommits: profile === "flagged"
      ? [{
        sha: uuid() + uuid(),
        message: "Add all files",
        date: randomDate(1),
        score: rand(0.6, 0.95),
        reasons: ["Large single commit", "Outside contest hours", "Bulk file addition"],
      }]
      : [],
    burstCommits: profile === "suspicious" || profile === "flagged"
      ? Array.from({ length: randInt(2, 5) }, () => ({
        sha: uuid() + uuid(),
        date: randomDate(2),
        intervalSeconds: randInt(5, 30),
      }))
      : [],
    avgCommitSuspicionScore: profile === "flagged"
      ? rand(0.5, 0.9)
      : profile === "suspicious"
        ? rand(0.2, 0.5)
        : rand(0, 0.15),
    similarityMatches: [],
    highestSimilarity: profile === "flagged" ? rand(0.7, 0.95) : 0,
    githubSuspicionScore: profile === "flagged"
      ? rand(0.6, 0.95)
      : profile === "suspicious"
        ? rand(0.3, 0.6)
        : rand(0, 0.2),
    lastProcessedSha: uuid() + uuid(),
    lastSyncAt: new Date(),
  };

  return analysis;
}

// ---------------------------------------------------------------------------
// Main seed function
// ---------------------------------------------------------------------------

async function seedFakeData() {
  console.log("\n  Seeding fake data...\n");

  // Clear existing data
  await Promise.all([
    Participant.deleteMany({}),
    Event.deleteMany({}),
    TypingPattern.deleteMany({}),
    GitHubAnalysis.deleteMany({}),
  ]);

  let totalEvents = 0;

  for (const template of PARTICIPANTS) {
    const config = PROFILES[template.profile];
    const suspicionScore =
      Math.round(rand(...config.scoreRange) * 1000) / 1000;

    // Create participant
    const participant = await Participant.create({
      machineId: `codespace-${template.github}-${uuid()}`,
      githubUsername: template.github,
      workspaceName: template.workspace,
      sessionId: uuid(),
      startTime: randomDate(4),
      lastActive: randomDate(0.1),
      totalEvents: 0,
      suspicionScore,
      stats: {
        pasteCount: template.profile === "flagged" ? randInt(10, 30) : randInt(0, 5),
        pasteCharsTotal: template.profile === "flagged" ? randInt(5000, 20000) : randInt(0, 1000),
        typingAnomalies: template.profile === "flagged" ? randInt(5, 15) : randInt(0, 3),
        windowBlurCount: template.profile === "suspicious" ? randInt(10, 30) : randInt(0, 8),
        windowBlurTotalMs: template.profile === "suspicious" ? randInt(300000, 900000) : randInt(0, 120000),
        clipboardChanges: randInt(0, 10),
        filesCreated: randInt(3, 20),
        filesDeleted: randInt(0, 5),
      },
    });

    // Generate and insert events
    const events = generateEvents(participant._id, template.profile);
    if (events.length > 0) {
      await Event.insertMany(events);
    }
    totalEvents += events.length;

    // Update totalEvents count
    participant.totalEvents = events.length;
    await participant.save();

    // Generate typing pattern
    const typingData = generateTypingPattern(participant._id, template.profile);
    await TypingPattern.create(typingData);

    // Generate GitHub analysis (80% chance)
    if (Math.random() > 0.2) {
      const ghData = generateGitHubAnalysis(
        participant._id,
        template.github,
        template.profile
      );
      await GitHubAnalysis.create(ghData);
    }

    const icon =
      template.profile === "flagged" ? "!!" :
        template.profile === "suspicious" ? "!" :
          template.profile === "moderate" ? "~" : " ";

    console.log(
      `  [${icon}] ${template.github.padEnd(18)} score=${suspicionScore.toFixed(3).padStart(5)}  events=${String(events.length).padStart(3)}  profile=${template.profile}`
    );
  }

  // Add some cross-participant similarity matches for flagged users
  const flaggedParticipants = await Participant.find({
    suspicionScore: { $gte: 0.7 },
  });
  const allParticipants = await Participant.find({});

  for (const fp of flaggedParticipants) {
    const ghAnalysis = await GitHubAnalysis.findOne({ participantId: fp._id });
    if (ghAnalysis && allParticipants.length > 2) {
      const other = allParticipants.find(
        (p) => p._id.toString() !== fp._id.toString() && p.suspicionScore >= 0.5
      );
      if (other) {
        ghAnalysis.similarityMatches.push({
          otherParticipantId: other._id,
          otherRepo: `${other.githubUsername}/contest-submission`,
          file1: "index.js",
          file2: "index.js",
          similarity: rand(0.75, 0.95),
          identicalContent: Math.random() > 0.5,
          detectedAt: new Date(),
        });
        ghAnalysis.highestSimilarity = Math.max(
          ghAnalysis.highestSimilarity,
          ghAnalysis.similarityMatches[0].similarity
        );
        await ghAnalysis.save();
      }
    }
  }

  const participantCount = await Participant.countDocuments();
  const eventCount = await Event.countDocuments();
  const flaggedCount = await Event.countDocuments({ flagged: true });

  console.log(`\n  Done!`);
  console.log(`  Participants : ${participantCount}`);
  console.log(`  Events       : ${eventCount} (${flaggedCount} flagged)`);
  console.log(`  Profiles     : clean(10) moderate(4) suspicious(3) flagged(2)`);
  console.log();
}

module.exports = { seedFakeData };

// Allow running directly
if (require.main === module) {
  const { connectDatabase } = require("../config/database");
  connectDatabase()
    .then(() => seedFakeData())
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
