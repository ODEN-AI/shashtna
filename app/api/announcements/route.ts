import { NextResponse } from "next/server";

import { getLiveAnnouncements } from "@/src/server/content";

export const dynamic = "force-dynamic";

/**
 * Public feed of live ads / announcements. The website renders them
 * server-side; Shashtna Player can read `?surface=PLAYER`.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const surface = searchParams.get("surface")?.toUpperCase() === "PLAYER" ? "PLAYER" : "WEBSITE";
    const placement = searchParams.get("placement")?.toUpperCase() || undefined;
    const items = await getLiveAnnouncements(surface, placement);

    return NextResponse.json(
      {
        success: true,
        announcements: items.map((item) => ({
          id: item.id,
          kind: item.kind,
          title: item.title,
          description: item.description,
          imageUrl: item.imageUrl,
          ctaLabel: item.ctaLabel,
          ctaUrl: item.ctaUrl,
          placement: item.placement,
          style: item.style,
          priority: item.priority,
          startsAt: item.startsAt,
          endsAt: item.endsAt,
        })),
      },
      { headers: { "Cache-Control": "public, max-age=60" } },
    );
  } catch (error) {
    console.error("GET /api/announcements error:", error);

    return NextResponse.json({ success: false, announcements: [] }, { status: 500 });
  }
}
