import { ok, withMobileUser } from "@/src/server/mobile/http";
import { mobileLoyalty } from "@/src/server/mobile/loyalty";

export const dynamic = "force-dynamic";

/** «نقاط شاشتنا» for the signed-in customer (the user comes from the token only). */
export const GET = withMobileUser(async ({ user }) => ok({ loyalty: await mobileLoyalty(user.id) }));
