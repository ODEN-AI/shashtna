import { getRecentResolvedIncidents } from "@/src/server/content";
import { ok, withPublic } from "@/src/server/mobile/http";
import { activeIncidents, serializeIncident } from "@/src/server/mobile/shape";

export const dynamic = "force-dynamic";

/** Same records as the website's /status page (website-only incidents left out). */
export const GET = withPublic(async () => {
  const [active, resolved] = await Promise.all([activeIncidents(), getRecentResolvedIncidents(10)]);
  const current = active.filter((item) => !item.upcoming);

  return ok({
    overall: current.some((item) => item.status === "OUTAGE") ? "OUTAGE" : current.length ? "DEGRADED" : "OPERATIONAL",
    active,
    resolved: resolved.filter((item) => item.component !== "WEBSITE").map(serializeIncident),
  });
});
