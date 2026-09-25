import type { MetadataRoute } from "next";

const SITE_URL = "https://shashtna.netlify.app";

// Public marketing pages only; account and admin pages are excluded.
const PUBLIC_PATHS = ["", "/apps", "/plans", "/services", "/devices", "/about"];

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_PATHS.map((path) => ({
    url: `${SITE_URL}${path}`,
  }));
}
