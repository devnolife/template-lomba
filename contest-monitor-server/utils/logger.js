const winston = require("winston");
const DailyRotateFile = require("winston-daily-rotate-file");
const path = require("path");

const LOG_DIR = process.env.LOG_DIR || path.join(__dirname, "..", "logs");

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: "contest-monitor" },
  transports: [
    // Console — always active
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(
          ({ timestamp, level, message, ...meta }) =>
            `${timestamp} ${level}: ${message}${
              Object.keys(meta).length > 1
                ? " " + JSON.stringify(meta, null, 0)
                : ""
            }`
        )
      ),
    }),

    // Rotate daily — info+ level
    new DailyRotateFile({
      dirname: LOG_DIR,
      filename: "contest-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      maxFiles: "14d",
      maxSize: "20m",
      level: "info",
    }),

    // Separate error log
    new DailyRotateFile({
      dirname: LOG_DIR,
      filename: "error-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      maxFiles: "30d",
      maxSize: "20m",
      level: "error",
    }),
  ],
});

module.exports = logger;
