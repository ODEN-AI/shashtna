import type { MetadataRoute } from "next";

const SITE_URL = "https://shashtna.netlify.app";

// Public pages only; account, checkout and admin pages are excluded (and
// marked noindex).
const PUBLIC_PATHS = [
  "",
  "/plans",
  "/watch",
  "/watch/player",
  "/apps",
  "/devices",
  "/help",
  "/help/troubleshooting",
  "/help/payment",
  "/help/contact",
  "/status",
  "/about",
  "/services",
  "/services/request",
  "/terms",
  "/privacy",
  "/refund",
];

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_PATHS.map((path) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency: path === "" || path === "/plans" || path === "/status" ? "daily" : "weekly",
    priority: path === "" ? 1 : path === "/plans" ? 0.9 : 0.6,
  }));
}
