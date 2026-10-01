import { consoleWorkerSource } from "@/src/lib/console-sw";

/**
 * The Shashtna Console service worker. Served from /admin so its scope is
 * the admin console only (the public website is never controlled by it).
 * It is public, static and contains no data; see src/lib/console-sw.ts for
 * the caching policy.
 */
export const dynamic = "force-static";

export function GET() {
  return new Response(consoleWorkerSource(), {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Service-Worker-Allowed": "/admin",
      "Content-Security-Policy": "default-src 'self'; script-src 'self'",
    },
  });
}
