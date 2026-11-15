import { cookies } from "next/headers";

import { APP_MODE_COOKIE } from "@/src/lib/app-handoff";

/**
 * Whether this page is shown inside the Shashtna customer app's in-app
 * browser (set by /app/handoff). In app mode the website drops its own
 * header, footer and menus — the app has its own. Not a credential: it only
 * changes chrome, never access.
 */
export async function isAppMode() {
  try {
    return (await cookies()).get(APP_MODE_COOKIE)?.value === "1";
  } catch {
    return false;
  }
}
