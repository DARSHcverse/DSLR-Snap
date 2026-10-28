import type { NextConfig } from "next";

/**
 * The admin lives at a private address set in Vercel (ADMIN_PATH), never in the code, because the
 * repository can be read. That address is rewritten to the real /admin pages, and src/proxy.ts
 * answers "not found" to anyone asking for /admin directly.
 */
const adminPath = (process.env.ADMIN_PATH ?? "").replace(/^\/+|\/+$/g, "");

const nextConfig: NextConfig = {
  cacheComponents: true,
  async rewrites() {
    if (!/^[A-Za-z0-9_-]{12,}$/.test(adminPath)) return [];
    return {
      beforeFiles: [
        { source: `/${adminPath}`, destination: "/admin" },
        { source: `/${adminPath}/:path*`, destination: "/admin/:path*" },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
