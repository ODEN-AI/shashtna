import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,

  // Pre-redesign URLs keep working (query strings such as ?plan= are kept).
  async redirects() {
    return [
      { source: "/contact", destination: "/checkout", permanent: false },
      { source: "/renew", destination: "/subscriptions", permanent: false },
      { source: "/tickets", destination: "/support", permanent: false },
      { source: "/admin/subscription-requests", destination: "/admin/orders", permanent: false },
      { source: "/admin/activity-logs", destination: "/admin/audit", permanent: false },
      { source: "/admin/live-connections", destination: "/admin", permanent: false },
    ];
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
      {
        source: "/videos/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=604800" }],
      },
    ];
  },
};

export default nextConfig;
