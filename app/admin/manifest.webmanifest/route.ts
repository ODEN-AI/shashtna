/**
 * Web app manifest for the installable Shashtna admin console ("Shashtna
 * Console"). It is linked only from /admin pages, so the public website is
 * not offered as an install target. It carries no data and needs no session.
 */
export const dynamic = "force-static";

const manifest = {
  id: "/admin",
  name: "إدارة شاشتنا — Shashtna Console",
  short_name: "إدارة شاشتنا",
  description: "لوحة إدارة شاشتنا: الطلبات والاشتراكات والعملاء والمالية والمحتوى.",
  lang: "ar",
  dir: "rtl",
  start_url: "/admin?source=app",
  scope: "/admin",
  display: "standalone",
  display_override: ["standalone", "minimal-ui"],
  orientation: "any",
  background_color: "#020b2b",
  theme_color: "#020b2b",
  categories: ["business", "productivity", "finance"],
  prefer_related_applications: false,
  icons: [
    { src: "/console/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/console/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "/console/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
  shortcuts: [
    { name: "الطلبات", short_name: "الطلبات", url: "/admin/orders?source=app", icons: [{ src: "/console/shortcut-96.png", sizes: "96x96", type: "image/png" }] },
    { name: "العملاء", short_name: "العملاء", url: "/admin/customers?source=app", icons: [{ src: "/console/shortcut-96.png", sizes: "96x96", type: "image/png" }] },
    { name: "المالية والأداء", short_name: "المالية", url: "/admin/finance?source=app", icons: [{ src: "/console/shortcut-96.png", sizes: "96x96", type: "image/png" }] },
  ],
};

export function GET() {
  return new Response(JSON.stringify(manifest), {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
