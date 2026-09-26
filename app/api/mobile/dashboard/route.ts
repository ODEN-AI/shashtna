import { ok, withMobileUser } from "@/src/server/mobile-api";
import { mobileDashboard } from "@/src/server/mobile";

export const dynamic = "force-dynamic";

export const GET = withMobileUser(async ({ request, user }) => ok(await mobileDashboard(request, user)));
