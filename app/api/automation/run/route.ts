import { NextResponse } from "next/server";

import { JOBS, runKey, type Job } from "@/src/lib/automation";
import { verifyAutomationToken } from "@/src/lib/automation-token";
import { runJob } from "@/src/server/automation";

export const dynamic = "force-dynamic";

/**
 * Called by the Netlify scheduled function (netlify/functions/daily-digest.mts)
 * with `Authorization: Bearer <HMAC of the run key>`. Every guard — production
 * or local database, automation and the job switched on, the advisory lock and
 * the once-a-day run key — is applied again inside runJob.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { job?: string } | null;
  const job = (JOBS as readonly string[]).includes(String(body?.job)) ? (body!.job as Job) : null;

  if (!job) return NextResponse.json({ ok: false, error: "UNKNOWN_JOB" }, { status: 400 });

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;

  if (!verifyAutomationToken(process.env.AUTH_SECRET, runKey(job), token)) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const result = await runJob(job, { trigger: "SCHEDULE" });

  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: result.status });

  // Counts only — no customer data leaves in the response.
  return NextResponse.json({ ok: true, status: result.status, runKey: result.runKey, reason: result.reason ?? null, stats: result.stats ?? null });
}
