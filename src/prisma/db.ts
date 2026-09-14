import "dotenv/config";
import postgres from "@prisma/orm-postgres/runtime";
import type { Contract } from "./contract.d";
import contractJson from "./contract.json" with { type: "json" };

const databaseUrl = process.env["DATABASE_URL"];

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not configured.");
}

export const db = postgres<Contract>({
  contractJson,
  url: databaseUrl,
});

/**
 * The Prisma Postgres runtime manages the client connection itself.
 *
 * Calling db.connect() manually can cause:
 * DRIVER.ALREADY_CONNECTED
 * when multiple API routes are loaded or requested during development.
 *
 * Keep this function for compatibility with the existing API routes,
 * but intentionally do not call connect() here.
 */
export async function ensureDatabaseConnection() {
  return;
}