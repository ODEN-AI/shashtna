import { createHmac } from "node:crypto";

/**
 * Netlify Scheduled Function: the morning jobs — the owner's daily list and
 * the customers' in-app reminders — at 06:00 Baghdad
 * (03:00 UTC). Netlify runs scheduled functions only on published production
 * deploys; the CONTEXT check below is a second guard so a preview never
 * triggers it. The site endpoint re-checks everything (settings, lock, the
 * once-a-day run key), so a manual or repeated call is harmless.
 *
 * The token is the same HMAC as src/lib/automation-token.ts over each run key
 * `<job>:<Baghdad day>`. Each job has its own switch; one that is off is skipped
 * by the endpoint.
 */
type DeployContext = { deploy?: { context?: string }; site?: { url?: string } };

export default async function dailyDigest(_request: Request, context?: DeployContext) {
  // The deploy context comes from the function context at run time; CONTEXT
  // is a build-time variable and may be missing here.
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

  for (const job of ["daily-digest", "customer-reminders"]) {
    const token = createHmac("sha256", secret).update(`automation:${job}:${day}`).digest("hex");
    const response = await fetch(`${site.replace(/\/$/, "")}/api/automation/run`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ job }),
    });

    console.log("AUTOMATION_RESULT", job, response.status, await response.text());
  }
}

export const config = { schedule: "0 3 * * *" };
