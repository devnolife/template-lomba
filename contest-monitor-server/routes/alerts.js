const express = require("express");
const https = require("https");
const http = require("http");
const nodemailer = require("nodemailer");
const router = express.Router();

const { requireAuth } = require("../middleware/auth");
const logger = require("../utils/logger");

// ---------------------------------------------------------------------------
// Webhook dispatcher — sends alerts to Slack, Discord, Email
// ---------------------------------------------------------------------------

/**
 * POST JSON to a webhook URL (Slack or Discord compatible).
 * @param {string} webhookUrl
 * @param {object} payload
 * @returns {Promise<void>}
 */
function postWebhook(webhookUrl, payload) {
  return new Promise((resolve, reject) => {
    try {
      const parsed = new URL(webhookUrl);
      const transport = parsed.protocol === "https:" ? https : http;
      const body = JSON.stringify(payload);

      const options = {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
        timeout: 10000,
      };

      const req = transport.request(options, (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve();
          } else {
            reject(new Error(`Webhook returned ${res.statusCode}: ${data.slice(0, 200)}`));
          }
        });
      });

      req.on("error", reject);
      req.on("timeout", () => {
        req.destroy();
        reject(new Error("Webhook request timed out"));
      });
      req.write(body);
      req.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Format alert data into a Slack-compatible message.
 */
function formatSlackMessage(alert) {
  const emoji = alert.level === "critical" ? ":rotating_light:" : ":warning:";
  return {
    text: `${emoji} *Contest Alert — ${alert.level.toUpperCase()}*`,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `${alert.level === "critical" ? "CRITICAL" : "WARNING"} Alert`,
        },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Participant:*\n${alert.displayName}` },
          { type: "mrkdwn", text: `*Score:*\n${alert.suspicionScore}` },
          { type: "mrkdwn", text: `*Level:*\n${alert.level}` },
          { type: "mrkdwn", text: `*Time:*\n${alert.timestamp}` },
        ],
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Reasons:*\n${alert.reasons.map((r) => `• ${r}`).join("\n")}`,
        },
      },
    ],
  };
}

/**
 * Format alert data into a Discord-compatible embed.
 */
function formatDiscordMessage(alert) {
  const color = alert.level === "critical" ? 0xff0000 : 0xffaa00;
  return {
    content: `**Contest Alert — ${alert.level.toUpperCase()}**`,
    embeds: [
      {
        title: `${alert.level === "critical" ? "CRITICAL" : "WARNING"}: ${alert.displayName}`,
        color,
        fields: [
          { name: "Suspicion Score", value: String(alert.suspicionScore), inline: true },
          { name: "Level", value: alert.level, inline: true },
          { name: "Reasons", value: alert.reasons.map((r) => `• ${r}`).join("\n") },
        ],
        timestamp: alert.timestamp,
      },
    ],
  };
}

/**
 * Send email alert using nodemailer.
 */
async function sendEmailAlert(alert) {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT || 587;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const alertEmail = process.env.ALERT_EMAIL;

  if (!smtpHost || !smtpUser || !smtpPass || !alertEmail) {
    logger.debug("Email alert skipped — SMTP not configured");
    return;
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: Number(smtpPort),
    secure: Number(smtpPort) === 465,
    auth: { user: smtpUser, pass: smtpPass },
  });

  const subject = `[Contest ${alert.level.toUpperCase()}] ${alert.displayName} — score ${alert.suspicionScore}`;
  const body = [
    `Participant: ${alert.displayName}`,
    `Machine ID: ${alert.machineId}`,
    `Suspicion Score: ${alert.suspicionScore}`,
    `Level: ${alert.level}`,
    `Time: ${alert.timestamp}`,
    "",
    "Reasons:",
    ...alert.reasons.map((r) => `  - ${r}`),
  ].join("\n");

  await transporter.sendMail({
    from: smtpUser,
    to: alertEmail,
    subject,
    text: body,
  });

  logger.info(`Email alert sent to ${alertEmail}`);
}

// ---------------------------------------------------------------------------
// POST /api/alerts — manual or automated alert dispatch
// ---------------------------------------------------------------------------

router.post("/", requireAuth, async (req, res) => {
  try {
    const alert = req.body;

    if (!alert.displayName || !alert.level || !alert.reasons) {
      return res.status(400).json({ error: "Missing required alert fields: displayName, level, reasons" });
    }

    alert.timestamp = alert.timestamp || new Date().toISOString();
    alert.suspicionScore = alert.suspicionScore || 0;

    const results = {
      slack: { sent: false },
      discord: { sent: false },
      email: { sent: false },
    };

    // --- Slack ---
    const slackUrl = process.env.SLACK_WEBHOOK_URL;
    if (slackUrl) {
      try {
        await postWebhook(slackUrl, formatSlackMessage(alert));
        results.slack.sent = true;
        logger.info("Slack alert sent");
      } catch (err) {
        results.slack.error = err.message;
        logger.error(`Slack alert failed: ${err.message}`);
      }
    }

    // --- Discord ---
    const discordUrl = process.env.DISCORD_WEBHOOK_URL;
    if (discordUrl) {
      try {
        await postWebhook(discordUrl, formatDiscordMessage(alert));
        results.discord.sent = true;
        logger.info("Discord alert sent");
      } catch (err) {
        results.discord.error = err.message;
        logger.error(`Discord alert failed: ${err.message}`);
      }
    }

    // --- Email ---
    try {
      await sendEmailAlert(alert);
      results.email.sent = true;
    } catch (err) {
      results.email.error = err.message;
      logger.error(`Email alert failed: ${err.message}`);
    }

    // --- Socket.io broadcast ---
    const io = req.app.get("io");
    if (io) {
      io.to("dashboard").emit("alert", alert);
    }

    res.json({ success: true, results });
  } catch (err) {
    logger.error(`POST /api/alerts error: ${err.message}`);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// Exported helper — called internally from events route when auto-alerting
// ---------------------------------------------------------------------------

/**
 * Dispatch an alert to all configured channels. Fire-and-forget.
 * @param {object} alert
 */
async function dispatchAlert(alert) {
  try {
    const slackUrl = process.env.SLACK_WEBHOOK_URL;
    const discordUrl = process.env.DISCORD_WEBHOOK_URL;

    const promises = [];

    if (slackUrl) {
      promises.push(
        postWebhook(slackUrl, formatSlackMessage(alert)).catch((err) =>
          logger.error(`Slack dispatch failed: ${err.message}`)
        )
      );
    }
    if (discordUrl) {
      promises.push(
        postWebhook(discordUrl, formatDiscordMessage(alert)).catch((err) =>
          logger.error(`Discord dispatch failed: ${err.message}`)
        )
      );
    }
    promises.push(
      sendEmailAlert(alert).catch((err) =>
        logger.error(`Email dispatch failed: ${err.message}`)
      )
    );

    await Promise.allSettled(promises);
  } catch (err) {
    logger.error(`dispatchAlert error: ${err.message}`);
  }
}

module.exports = router;
module.exports.dispatchAlert = dispatchAlert;
