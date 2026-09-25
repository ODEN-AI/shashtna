import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/api/",
        "/dashboard",
        "/subscriptions",
        "/orders",
        "/receipts",
        "/support",
        "/account",
        "/notifications",
        "/checkout",
        "/login",
        "/register",
        "/forgot-password",
        "/reset-password",
      ],
    },
    sitemap: "https://shashtna.netlify.app/sitemap.xml",
  };
}
