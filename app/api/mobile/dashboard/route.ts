import { ok, positiveInt, withMobileUser } from "@/src/server/mobile-api";
import { mobileDashboard } from "@/src/server/mobile";

export const dynamic = "force-dynamic";

/** `?order=<id>` highlights the order just created at checkout. */
export const GET = withMobileUser(async ({ request, user }) =>
  ok(await mobileDashboard(request, user, positiveInt(new URL(request.url).searchParams.get("order")))),
);
