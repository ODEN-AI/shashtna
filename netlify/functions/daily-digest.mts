import { createHmac } from "node:crypto";

/**
 * Netlify Scheduled Function: the owner's morning daily list, 06:00 Baghdad
 * (03:00 UTC). Netlify runs scheduled functions only on published production
 * deploys; the CONTEXT check below is a second guard so a preview never
 * triggers it. The site endpoint re-checks everything (settings, lock, the
 * once-a-day run key), so a manual or repeated call is harmless.
 *
 * The token is the same HMAC as src/lib/automation-token.ts over the run key
 * `daily-digest:<Baghdad day>`.
 */
export default async function dailyDigest() {
  if (process.env.CONTEXT !== "production") {
    console.log("AUTOMATION_SKIPPED: not the production deploy");
    return;
  }

  const secret = process.env.AUTH_SECRET;
  const site = process.env.URL;

  if (!secret || !site) {
    console.error("AUTOMATION_MISCONFIGURED: AUTH_SECRET or URL missing");
    return;
  }

  const day = new Date(Date.now() + 3 * 3_600_000).toISOString().slice(0, 10); // Baghdad, UTC+3
  const token = createHmac("sha256", secret).update(`automation:daily-digest:${day}`).digest("hex");
  const response = await fetch(`${site.replace(/\/$/, "")}/api/automation/run`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ job: "daily-digest" }),
  });

  console.log("AUTOMATION_RESULT", response.status, await response.text());
}

export const config = { schedule: "0 3 * * *" };
