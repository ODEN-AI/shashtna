import { NextResponse } from "next/server";

import { getActiveIncidents } from "@/src/server/content";
import { getSettings, safeExternalUrl, whatsappLink } from "@/src/server/settings";

export const dynamic = "force-dynamic";

const SITE = "https://shashtna.netlify.app";

/**
 * Public remote configuration for Shashtna Player: official links, support
 * channels and active incidents. Everything comes from Admin → Settings and
 * Admin → Service status; nothing here is hard-coded business data.
 */
export async function GET() {
  try {
    const [settings, incidents] = await Promise.all([getSettings(), getActiveIncidents()]);

    return NextResponse.json(
      {
        success: true,
        version: 1,
        links: {
          website: SITE,
          apps: `${SITE}/apps`,
          plans: `${SITE}/plans`,
          account: `${SITE}/dashboard`,
          subscriptions: `${SITE}/subscriptions`,
          support: `${SITE}/support`,
          help: `${SITE}/help`,
          status: `${SITE}/status`,
        },
        support: {
          hours: { ar: settings["support.hours"], en: settings["support.hoursEn"] },
          telegram: safeExternalUrl(settings["contact.telegram"]),
          whatsapp: whatsappLink(settings["contact.whatsapp"]),
          facebook: safeExternalUrl(settings["contact.facebook"]),
          phone: settings["contact.phone"] || null,
        },
        incidents: incidents
          .filter((incident) => incident.component === "ALL" || incident.component === "PLAYER" || incident.component === "IPTV" || incident.component === "VIP")
          .map((incident) => ({
            id: incident.id,
            title: incident.title,
            message: incident.message,
            status: incident.status,
            component: incident.component,
            startsAt: incident.startsAt,
            upcoming: incident.upcoming,
          })),
      },
      { headers: { "Cache-Control": "public, max-age=60" } },
    );
  } catch (error) {
    console.error("GET /api/mobile/config error:", error);

    return NextResponse.json({ success: false }, { status: 500 });
  }
}
