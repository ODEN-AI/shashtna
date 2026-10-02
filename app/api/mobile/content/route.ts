import { ok, withPublic } from "@/src/server/mobile/http";
import { mobileContent } from "@/src/server/mobile/shape";

export const dynamic = "force-dynamic";

/**
 * Live offers and announcements from Admin → Ads & announcements (targeted
 * at ALL or WEBSITE, scheduled live, audience "everyone"/guests). Signed-in
 * customers get their own audience on the dashboard.
 */
export const GET = withPublic(async ({ request }) => ok(await mobileContent(request)));
