import { NextResponse } from "next/server";

import { getSessionUser } from "@/src/server/auth";
import { getI18n } from "@/src/server/i18n";
import { buildEntryPayload } from "@/src/server/promotions";

export const dynamic = "force-dynamic";

/**
 * The website's entry experience for the current visitor (guest promotion
 * or member spotlight). Called by the browser at most once per session.
 * Read-only; personal content (renewal, orders) is built only from the
 * signed-in visitor's own account. Website-internal — not a mobile/Player
 * contract.
 */
export async function GET() {
  try {
    const [user, { lang }] = await Promise.all([getSessionUser().catch(() => null), getI18n()]);
    const payload = await buildEntryPayload(user, lang);

    return NextResponse.json(payload, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("GET /api/site/entry error:", error);

    return NextResponse.json({ mode: "none" }, { headers: { "Cache-Control": "private, no-store" } });
  }
}
