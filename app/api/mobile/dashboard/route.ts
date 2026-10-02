import { mobileDashboard } from "@/src/server/mobile/dashboard";
import { ok, positiveInt, withMobileUser } from "@/src/server/mobile/http";

export const dynamic = "force-dynamic";

/** The app's home screen. `?order=<id>` highlights the order just created (only if it is the customer's). */
export const GET = withMobileUser(async ({ request, user }) =>
  ok(await mobileDashboard(request, user, positiveInt(new URL(request.url).searchParams.get("order")))),
);
