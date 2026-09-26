import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import { db } from "@/src/prisma/db";
import { ensureRenewalReminders } from "@/src/server/notifications";
import { dispatchDueCampaigns } from "@/src/server/push-campaigns";
import { checkPushReceipts } from "@/src/server/push";
import { listSubscriptionsForUser } from "@/src/server/subscriptions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Background job, called every few minutes by the Netlify scheduled function
 * (netlify/functions/push-dispatch.mts) with `Authorization: Bearer
 * $CRON_SECRET`:
 *
 *  1. sends scheduled mobile notifications whose time has come;
 *  2. creates (and pushes) renewal reminders for every customer, so they
 *     reach the phone even when the customer doesn't open the app — the
 *     per-subscription dedupe key means each reminder is sent once;
 *  3. checks push receipts and deactivates dead tokens.
 */
function authorized(request: Request) {
  const secret = String(process.env.CRON_SECRET ?? "").trim();
  const header = request.headers.get("authorization") ?? "";

  if (secret.length < 24) {
    return false;
  }

  const expected = Buffer.from(`Bearer ${secret}`);
  const provided = Buffer.from(header);

  return expected.length === provided.length && timingSafeEqual(expected, provided);
}

async function renewalReminders() {
  const users = await db.orm.public.User.where({ renewalReminders: true }).all();
  const owners = new Set((await db.orm.public.Subscription.all()).map((subscription) => subscription.userId));
  let checked = 0;

  for (const user of users) {
    if (!owners.has(user.id)) {
      continue;
    }

    checked += 1;
    await ensureRenewalReminders(user.id, await listSubscriptionsForUser(user.id), true).catch(() => undefined);
  }

  return checked;
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ success: false }, { status: 401 });
  }

  const started = Date.now();
  const campaigns = await dispatchDueCampaigns();
  const reminders = await renewalReminders();
  const receipts = await checkPushReceipts();

  return NextResponse.json(
    { success: true, campaigns, remindersChecked: reminders, receipts, ms: Date.now() - started },
    { headers: { "Cache-Control": "no-store" } },
  );
}
