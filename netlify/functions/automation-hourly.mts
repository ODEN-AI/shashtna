import { createHmac } from "node:crypto";

/**
 * Netlify Scheduled Function: the hourly automation pass. It retries a
 * switched-on job whose run today FAILED or was cut off (with backoff, at most
 * 3 attempts), retries due outbox rows, and raises the 09:00 heartbeat when a
 * switched-on job has not succeeded today — so a missed 06:00 trigger is
 * noticed. Same guards as daily-digest.mts: production deploy only, then the
 * endpoint re-checks everything. The token is the HMAC of
 * `automation:maintenance:<Baghdad day>` (src/lib/automation-token.ts).
 */
type DeployContext = { deploy?: { context?: string }; site?: { url?: string } };

export default async function automationHourly(_request: Request, context?: DeployContext) {
  const deployContext = context?.deploy?.context ?? process.env.CONTEXT;

  if (deployContext !== "production") {
    console.log("AUTOMATION_SKIPPED: not the production deploy");
    return;
  }

  const secret = process.env.AUTH_SECRET;
  const site = context?.site?.url ?? process.env.URL;

  if (!secret || !site) {
    console.error("AUTOMATION_MISCONFIGURED: AUTH_SECRET or URL missing");
    return;
  }

  const day = new Date(Date.now() + 3 * 3_600_000).toISOString().slice(0, 10); // Baghdad, UTC+3
  const token = createHmac("sha256", secret).update(`automation:maintenance:${day}`).digest("hex");
  const response = await fetch(`${site.replace(/\/$/, "")}/api/automation/run`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ job: "maintenance" }),
  });

  console.log("AUTOMATION_MAINTENANCE", response.status, await response.text());
}

// Every hour at :20, clear of the 06:00 (03:00 UTC) morning run.
export const config = { schedule: "20 * * * *" };
