import { getRecentResolvedIncidents } from "@/src/server/content";
import { activeIncidents, serializeIncident } from "@/src/server/mobile";
import { ok, withPublic } from "@/src/server/mobile-api";

export const dynamic = "force-dynamic";

/** Same records as the website's /status page. */
export const GET = withPublic(async () => {
  const [active, resolved] = await Promise.all([activeIncidents(), getRecentResolvedIncidents(10)]);

  return ok(
    {
      overall: active.some((item) => !item.upcoming && item.status === "OUTAGE")
        ? "OUTAGE"
        : active.some((item) => !item.upcoming)
          ? "DEGRADED"
          : "OPERATIONAL",
      active,
      resolved: resolved.filter((item) => item.component !== "WEBSITE").map(serializeIncident),
    },
    { headers: { "Cache-Control": "public, max-age=30" } },
  );
});
