/**
 * Runs every 5 minutes on Netlify and triggers the push job in the Next.js
 * app (/api/cron/push). Requires the CRON_SECRET environment variable to be
 * set on the site (the same value is checked by the route).
 */
export default async function pushDispatch() {
  const base = process.env.URL;
  const secret = process.env.CRON_SECRET;

  if (!base || !secret) {
    console.error("PUSH_DISPATCH: URL or CRON_SECRET is not configured");
    return;
  }

  const response = await fetch(`${base}/api/cron/push`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}` },
  });

  console.log("PUSH_DISPATCH:", response.status);
}

export const config = {
  schedule: "*/5 * * * *",
};
