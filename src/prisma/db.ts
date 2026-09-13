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

let connectionPromise: ReturnType<typeof db.connect> | null = null;

export async function ensureDatabaseConnection() {
  if (!connectionPromise) {
    connectionPromise = db
      .connect({
        url: databaseUrl as string,
      })
      .catch((error) => {
        connectionPromise = null;
        throw error;
      });
  }

  await connectionPromise;
}