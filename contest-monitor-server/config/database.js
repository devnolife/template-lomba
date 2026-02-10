const mongoose = require("mongoose");
const logger = require("../utils/logger");

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/contest-monitor";

/**
 * Connect to MongoDB with retry logic.
 * @param {number} [maxRetries=5]
 */
async function connectDatabase(maxRetries = 5) {
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      await mongoose.connect(MONGODB_URI, {
        // Mongoose 7+ no longer needs useNewUrlParser / useUnifiedTopology.
        autoIndex: true,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });

      logger.info(`MongoDB connected: ${mongoose.connection.host}`);

      mongoose.connection.on("error", (err) => {
        logger.error(`MongoDB connection error: ${err.message}`);
      });

      mongoose.connection.on("disconnected", () => {
        logger.warn("MongoDB disconnected — will attempt reconnect");
      });

      return;
    } catch (err) {
      attempt++;
      const delay = Math.min(Math.pow(2, attempt) * 1000, 30000);
      logger.error(
        `MongoDB connection attempt ${attempt}/${maxRetries} failed: ${err.message}`
      );
      if (attempt < maxRetries) {
        logger.info(`Retrying in ${delay / 1000}s...`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  logger.error("Could not connect to MongoDB after maximum retries — exiting.");
  process.exit(1);
}

module.exports = { connectDatabase };
