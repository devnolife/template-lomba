const logger = require("./logger");

// ---------------------------------------------------------------------------
// Thresholds (tuneable per contest)
// ---------------------------------------------------------------------------

const THRESHOLDS = {
  // Paste
  PASTE_MEDIUM_CHARS: 100,
  PASTE_LARGE_CHARS: 500,
  PASTE_MEDIUM_SCORE: 0.6,
  PASTE_LARGE_SCORE: 0.9,

  // Typing speed
  FAST_TYPING_INTERVAL_MS: 30,
  FAST_TYPING_SCORE: 0.4,

  // Typing variance
  HIGH_VARIANCE: 15000, // ms^2
  HIGH_VARIANCE_SCORE: 0.3,

  // Window blur
  LONG_BLUR_SECONDS: 120,
  LONG_BLUR_SCORE: 0.2,

  // Clipboard burst
  CLIPBOARD_BURST_COUNT: 5,
  CLIPBOARD_BURST_WINDOW_MS: 60000,
  CLIPBOARD_BURST_SCORE: 0.3,

  // File created without typing
  FILE_NO_TYPING_SCORE: 0.5,

  // Alert thresholds
  ALERT_SCORE: 0.7,
  WARNING_PASTE_COUNT: 10,
  WARNING_BLUR_TOTAL_MS: 600000, // 10 min
};

// ---------------------------------------------------------------------------
// Per-event scoring
// ---------------------------------------------------------------------------

/**
 * Calculate a suspicion score for a single event.
 *
 * @param {object} event           – raw event from the extension
 * @param {object} [typingStats]   – { avgInterval, variance } from TypingPattern
 * @param {object} [recentContext] – { clipboardChanges60s, hadTypingBefore }
 * @returns {{ score: number, reasons: string[] }}
 */
function calculateEventSuspicion(event, typingStats = {}, recentContext = {}) {
  let score = 0;
  const reasons = [];

  const type = event.type || event.eventType;
  const data = event.data || {};

  // ---- Paste detection ---------------------------------------------------
  if (type === "paste") {
    const len = data.length || 0;
    if (len > THRESHOLDS.PASTE_LARGE_CHARS) {
      score += THRESHOLDS.PASTE_LARGE_SCORE;
      reasons.push(`large_paste(${len}chars)`);
    } else if (len > THRESHOLDS.PASTE_MEDIUM_CHARS) {
      score += THRESHOLDS.PASTE_MEDIUM_SCORE;
      reasons.push(`medium_paste(${len}chars)`);
    }
  }

  // ---- Typing speed anomaly ----------------------------------------------
  if (type === "typing" && data.anomaly === "fast_typing") {
    const interval = data.interval || 0;
    if (interval > 0 && interval < THRESHOLDS.FAST_TYPING_INTERVAL_MS) {
      score += THRESHOLDS.FAST_TYPING_SCORE;
      reasons.push(`fast_typing(${interval}ms)`);
    }
  }

  // ---- Typing pattern stats (from aggregated pattern) --------------------
  if (typingStats.avgInterval > 0) {
    if (typingStats.avgInterval < THRESHOLDS.FAST_TYPING_INTERVAL_MS) {
      score += THRESHOLDS.FAST_TYPING_SCORE;
      reasons.push(`avg_typing_too_fast(${typingStats.avgInterval}ms)`);
    }
  }
  if (typingStats.variance > THRESHOLDS.HIGH_VARIANCE) {
    score += THRESHOLDS.HIGH_VARIANCE_SCORE;
    reasons.push(`high_variance(${Math.round(typingStats.variance)})`);
  }

  // ---- Window blur -------------------------------------------------------
  if (type === "window_blur" && data.focused === false) {
    const durationMs = data.unfocusedDurationMs || 0;
    if (durationMs > THRESHOLDS.LONG_BLUR_SECONDS * 1000) {
      score += THRESHOLDS.LONG_BLUR_SCORE;
      reasons.push(`long_blur(${Math.round(durationMs / 1000)}s)`);
    }
  }

  // ---- Clipboard burst ---------------------------------------------------
  if (type === "clipboard") {
    const recent = recentContext.clipboardChanges60s || 0;
    if (recent > THRESHOLDS.CLIPBOARD_BURST_COUNT) {
      score += THRESHOLDS.CLIPBOARD_BURST_SCORE;
      reasons.push(`clipboard_burst(${recent}in60s)`);
    }
  }

  // ---- File created without prior typing ---------------------------------
  if (type === "file_operation" && data.operation === "create") {
    if (recentContext.hadTypingBefore === false) {
      score += THRESHOLDS.FILE_NO_TYPING_SCORE;
      reasons.push("file_created_no_typing");
    }
  }

  // Clamp to [0, 1]
  score = Math.min(score, 1.0);
  score = Math.round(score * 1000) / 1000;

  return { score, reasons };
}

// ---------------------------------------------------------------------------
// Aggregate participant score
// ---------------------------------------------------------------------------

/**
 * Recalculate the overall suspicion score for a participant based on their
 * stats counters. This produces a weighted average that represents the
 * participant's general risk level.
 *
 * @param {object} stats – participant.stats subdocument
 * @returns {number} 0..1
 */
function calculateParticipantSuspicion(stats) {
  let score = 0;

  // Paste frequency
  if (stats.pasteCount > 0) {
    // Logarithmic scale: 1 paste = 0.1, 10 = 0.3, 50+ = 0.5
    score += Math.min(Math.log10(stats.pasteCount + 1) * 0.18, 0.5);
  }

  // Large paste volume
  if (stats.pasteCharsTotal > 1000) {
    score += Math.min(stats.pasteCharsTotal / 10000, 0.3);
  }

  // Typing anomaly frequency
  if (stats.typingAnomalies > 5) {
    score += Math.min(stats.typingAnomalies / 100, 0.2);
  }

  // Window blur total
  if (stats.windowBlurTotalMs > THRESHOLDS.WARNING_BLUR_TOTAL_MS) {
    score += 0.15;
  }

  // Clipboard changes
  if (stats.clipboardChanges > 20) {
    score += Math.min(stats.clipboardChanges / 200, 0.15);
  }

  return Math.min(Math.round(score * 1000) / 1000, 1.0);
}

// ---------------------------------------------------------------------------
// Alert check
// ---------------------------------------------------------------------------

/**
 * Determine if an alert should fire for a participant.
 *
 * @param {object} participant – Mongoose document
 * @returns {{ shouldAlert: boolean, level: string, reasons: string[] }}
 */
function checkAlertConditions(participant) {
  const reasons = [];
  let level = "none";

  if (participant.suspicionScore > THRESHOLDS.ALERT_SCORE) {
    level = "critical";
    reasons.push(
      `suspicion_score(${participant.suspicionScore})>${THRESHOLDS.ALERT_SCORE}`
    );
  }

  if (participant.stats.pasteCount > THRESHOLDS.WARNING_PASTE_COUNT) {
    if (level !== "critical") level = "warning";
    reasons.push(
      `paste_count(${participant.stats.pasteCount})>${THRESHOLDS.WARNING_PASTE_COUNT}`
    );
  }

  if (participant.stats.windowBlurTotalMs > THRESHOLDS.WARNING_BLUR_TOTAL_MS) {
    if (level !== "critical") level = "warning";
    reasons.push(
      `blur_total(${Math.round(participant.stats.windowBlurTotalMs / 1000)}s)>600s`
    );
  }

  return {
    shouldAlert: level !== "none",
    level,
    reasons,
  };
}

module.exports = {
  THRESHOLDS,
  calculateEventSuspicion,
  calculateParticipantSuspicion,
  checkAlertConditions,
};
