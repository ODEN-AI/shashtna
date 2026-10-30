#!/usr/bin/env node
/**
 * «نقاط شاشتنا» — the one-time launch gift (seedAtLaunch in src/server/loyalty.ts):
 * `loyalty.seedPoints` for each customer with an active IPTV subscription and
 * at least one paid, completed IPTV order on the site. Once per customer
 * (key seed:user:<id>), so a second run gives nothing twice.
 *
 *   node --experimental-strip-types scripts/loyalty/seed.mjs --check   # counts only, writes nothing
 *   node --experimental-strip-types scripts/loyalty/seed.mjs           # writes the SEED entries
 *
 * It refuses any non-local DATABASE_URL. A production run needs the owner's
 * explicit approval first (CLAUDE.md, "Production database"); only then set
 * LOYALTY_SEED_ALLOW_REMOTE=approved for that one run. It prints counts only:
 * no names, phone numbers or connection strings.
 */
import { register } from "node:module";

await import("dotenv/config");

const check = process.argv.includes("--check");
let host = "";

try {
  host = new URL(process.env.DATABASE_URL ?? "").hostname;
} catch {
  console.error("DATABASE_URL is missing or invalid.");
  process.exit(2);
}

const local = host === "localhost" || host === "127.0.0.1";

if (!local && process.env.LOYALTY_SEED_ALLOW_REMOTE !== "approved") {
  console.error("Refusing to run: DATABASE_URL is not a local database. A production run needs the owner's approval first.");
  process.exit(2);
}

register("../../tests/alias-loader.mjs", import.meta.url);

const { seedAtLaunch } = await import("../../src/server/loyalty.ts");
const { db } = await import("../../src/prisma/db.ts");

try {
  const summary = await seedAtLaunch({ check });

  console.log(`mode: ${check ? "check (no writes)" : "write"}`);
  console.log(`target: ${local ? "local" : "remote (approved)"}`);
  console.log(`eligible customers: ${summary.eligible}`);
  console.log(`already seeded: ${summary.alreadySeeded}`);
  console.log(`to seed: ${summary.toSeed} × ${summary.seedPoints} points = ${summary.totalPoints} points`);
  console.log(`worst-case cost: $${summary.worstCaseUsd.toFixed(2)}`);
  if (!check) console.log(`written: ${summary.written}`);
} finally {
  await db.close();
}
