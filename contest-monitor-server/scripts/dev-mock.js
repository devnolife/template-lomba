#!/usr/bin/env node
/**
 * dev-mock.js — Start the server with an in-memory MongoDB + fake data.
 *
 * No MongoDB installation required. Perfect for frontend development.
 *
 * Usage:
 *   node scripts/dev-mock.js
 *   npm run dev:mock
 */

const { MongoMemoryServer } = require("mongodb-memory-server");

async function main() {
  console.log("\n  Starting in-memory MongoDB...");

  // 1. Start in-memory MongoDB
  const mongod = await MongoMemoryServer.create({
    instance: { port: 27018 }, // Use 27018 to avoid conflict with real MongoDB
  });

  const uri = mongod.getUri();
  console.log(`  MongoDB URI: ${uri}`);

  // 2. Set environment variables BEFORE loading the app
  process.env.MONGODB_URI = uri;
  process.env.PORT = process.env.PORT || "3000";
  process.env.JWT_SECRET = "dev-mock-secret-key-not-for-production";
  process.env.ADMIN_USERNAME = "admin";
  process.env.ADMIN_PASSWORD = "admin123";
  process.env.CORS_ORIGINS = "http://localhost:5173,http://localhost:3000";
  process.env.LOG_LEVEL = "info";
  // Don't set GITHUB_TOKEN so cron job doesn't start

  // 3. Connect to the in-memory DB and seed fake data
  const { connectDatabase } = require("../config/database");
  await connectDatabase();

  const { seedFakeData } = require("./seed-fake-data");
  await seedFakeData();

  // 4. Start the actual server (it will use the env vars we set above)
  //    We need to require server.js which calls connectDatabase again,
  //    but mongoose handles reconnect gracefully.
  console.log("  Starting Express server...\n");
  require("../server");

  // 5. Graceful shutdown
  const cleanup = async () => {
    console.log("\n  Shutting down in-memory MongoDB...");
    await mongod.stop();
    process.exit(0);
  };

  process.on("SIGTERM", cleanup);
  process.on("SIGINT", cleanup);
}

main().catch((err) => {
  console.error("Failed to start mock server:", err);
  process.exit(1);
});
