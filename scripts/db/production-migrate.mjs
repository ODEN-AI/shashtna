#!/usr/bin/env node
/**
 * Guarded database migration for the Netlify PRODUCTION build.
 *
 * Netlify publishes a deploy only when its build succeeds, so running this
 * before `next build` means new code never goes live on a database that lacks
 * its schema, and a failed check leaves the current site untouched.
 *
 *   node scripts/db/production-migrate.mjs           # apply (production context only)
 *   node scripts/db/production-migrate.mjs --check   # read-only: validate and print the plan
 *
 * Before applying anything it refuses to continue when:
 * - DATABASE_URL is missing (production must not build without its database);
 * - any migration recorded in prisma_contract.ledger is missing on disk or its
 *   migration_hash differs from the committed migration.json (an applied
 *   migration was edited — never re-run or skip over that);
 * - the database marker is not a contract on the committed migration chain.
 * It applies only up to the committed chain tip (`--to <hash>`), then checks
 * the marker reached it, re-checks the ledger and runs `prisma db verify`.
 * Connection strings are never printed.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const MIGRATIONS = join(ROOT, "migrations", "app");
const CHECK_ONLY = process.argv.includes("--check");
const context = process.env.CONTEXT ?? "";

const redact = (text) => String(text ?? "").replace(/postgres(ql)?:\/\/\S+/gi, "<database-url>");
const log = (message) => console.log(`[db-migrate] ${redact(message)}`);

function fail(message) {
  console.error(`[db-migrate] REFUSED: ${redact(message)}`);
  process.exit(1);
}

/** The committed migration chain: name, from, to, migrationHash per directory. */
export function readChain(dir = MIGRATIONS) {
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(dir, entry.name, "migration.json")))
    .map((entry) => {
      const meta = JSON.parse(readFileSync(join(dir, entry.name, "migration.json"), "utf8"));
      return { name: entry.name, from: meta.from ?? null, to: meta.to, hash: meta.migrationHash };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Pure decision logic (unit-tested): what to do given the ledger, the marker and the chain. */
export function planMigration({ chain, ledger, marker }) {
  const byName = new Map(chain.map((m) => [m.name, m]));
  const problems = [];

  for (const row of ledger) {
    const local = byName.get(row.migration_name);
    if (!local) problems.push(`applied migration ${row.migration_name} is not in the repository`);
    else if (local.hash !== row.migration_hash) {
      problems.push(`applied migration ${row.migration_name} changed: database ${row.migration_hash.slice(0, 12)} ≠ repository ${local.hash.slice(0, 12)}`);
    }
  }

  const froms = new Set(chain.map((m) => m.from));
  const tips = chain.filter((m) => !froms.has(m.to));
  if (tips.length !== 1) problems.push(`the committed migration chain has ${tips.length} tips (expected 1)`);
  const tip = tips[0]?.to ?? null;

  const known = new Set(chain.flatMap((m) => [m.from, m.to]).filter(Boolean));
  if (marker && !known.has(marker)) problems.push(`database marker ${marker.slice(0, 12)} is not on the committed migration chain`);

  const pending = [];
  let cursor = marker ?? null;
  for (let guard = 0; cursor !== tip && guard < chain.length + 1; guard += 1) {
    const next = chain.find((m) => m.from === cursor);
    if (!next) {
      problems.push(`no committed migration continues from ${String(cursor).slice(0, 12)}`);
      break;
    }
    pending.push(next.name);
    cursor = next.to;
  }

  return { ok: problems.length === 0, problems, tip, pending };
}

async function readDatabaseState(url) {
  const { default: pg } = await import("pg");
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query("BEGIN READ ONLY");
    const exists = await client.query("SELECT to_regclass('prisma_contract.ledger') IS NOT NULL AS ledger, to_regclass('prisma_contract.marker') IS NOT NULL AS marker");
    if (!exists.rows[0].ledger || !exists.rows[0].marker) fail("prisma_contract.ledger / marker not found — not a database managed by this project's migrations");
    const ledger = (await client.query("SELECT migration_name, migration_hash FROM prisma_contract.ledger WHERE space = 'app' ORDER BY id")).rows;
    const marker = (await client.query("SELECT core_hash FROM prisma_contract.marker WHERE space = 'app'")).rows[0]?.core_hash ?? null;
    const columns = (await client.query("SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'package' AND column_name IN ('durationUnit', 'renewalPrice') ORDER BY 1")).rows.map((r) => r.column_name);
    await client.query("ROLLBACK");
    return { ledger, marker, columns };
  } finally {
    await client.end();
  }
}

function prisma(args) {
  const bin = join(ROOT, "node_modules", ".bin", "prisma");
  try {
    const out = execFileSync(bin, [...args, "--json"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], env: process.env });
    return JSON.parse(out.trim().split("\n").filter((line) => line.startsWith("{")).pop() ?? "{}");
  } catch (error) {
    fail(`prisma ${args.join(" ")} failed: ${String(error.stdout || error.stderr || error.message).split("\n").slice(-5).join(" ")}`);
  }
}

const succeeded = (result) => result?.ok === true || result?.envelope?.ok === true;

async function main() {
  if (!CHECK_ONLY && context !== "production") {
    log(`skipped: Netlify context "${context || "none"}" is not production`);
    return;
  }

  const url = process.env.DATABASE_URL;
  if (!url) {
    if (CHECK_ONLY) return log("check skipped: DATABASE_URL is not set");
    fail("DATABASE_URL is not set for the production build");
  }

  const chain = readChain();
  const before = await readDatabaseState(url);
  const plan = planMigration({ chain, ledger: before.ledger, marker: before.marker });

  log(`database marker ${String(before.marker).slice(0, 12)}, ${before.ledger.length} applied migrations, package columns present: ${before.columns.join(", ") || "none"}`);
  if (!plan.ok) fail(plan.problems.join("; "));
  log(plan.pending.length ? `pending: ${plan.pending.join(", ")} → target ${plan.tip.slice(0, 12)}` : "database is up to date");

  if (CHECK_ONLY || plan.pending.length === 0) return;

  const applied = prisma(["db", "migrate", "--to", plan.tip]);
  if (!succeeded(applied)) fail(`db migrate did not succeed: ${JSON.stringify(applied).slice(0, 400)}`);

  const after = await readDatabaseState(url);
  const recheck = planMigration({ chain, ledger: after.ledger, marker: after.marker });
  if (!recheck.ok || after.marker !== plan.tip) fail(`after migrating: marker ${String(after.marker).slice(0, 12)}, ${recheck.problems.join("; ")}`);

  const verified = prisma(["db", "verify"]);
  if (!succeeded(verified)) fail(`db verify did not succeed: ${JSON.stringify(verified).slice(0, 400)}`);

  log(`applied ${plan.pending.join(", ")}; marker ${after.marker.slice(0, 12)}; package columns: ${after.columns.join(", ")}; schema verified`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => fail(error?.message ?? error));
}
