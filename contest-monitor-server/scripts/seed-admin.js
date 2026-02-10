#!/usr/bin/env node
/**
 * Seed an admin user credential hash.
 *
 * Usage:
 *   node scripts/seed-admin.js                  # uses default password
 *   node scripts/seed-admin.js mySecretPass123   # custom password
 *
 * Outputs the bcrypt hash you should put in ADMIN_PASSWORD_HASH env var.
 */

const bcrypt = require("bcryptjs");

async function main() {
  const password = process.argv[2] || "contestadmin2024";

  const hash = await bcrypt.hash(password, 10);

  console.log("\n  Admin credentials\n");
  console.log(`  Username : admin`);
  console.log(`  Password : ${password}`);
  console.log(`  Hash     : ${hash}`);
  console.log(`\n  Set in .env:`);
  console.log(`  ADMIN_USERNAME=admin`);
  console.log(`  ADMIN_PASSWORD_HASH=${hash}\n`);
}

main().catch(console.error);
