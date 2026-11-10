import type { NextConfig } from "next";

/**
 * The admin lives at a private address set in Vercel (ADMIN_PATH), never in the code, because the
 * repository can be read. That address is rewritten to the real /admin pages, and src/proxy.ts
 * answers "not found" to anyone asking for /admin directly.
 */
const adminPath = (process.env.ADMIN_PATH ?? "").replace(/^\/+|\/+$/g, "");

/** Sent on every page. Clickjacking is blocked everywhere except the gallery and homepage pages operators embed. */
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
];
const NO_FRAMING = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  async headers() {
    return [
      { source: "/:path*", headers: SECURITY_HEADERS },
      // Everything but /e/<token> (event galleries) and /b/<name> (operator homepages), which have embed codes.
      { source: "/((?!e/|b/).*)", headers: NO_FRAMING },
    ];
  },
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
