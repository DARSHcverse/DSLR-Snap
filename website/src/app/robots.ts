import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    // Guest and host galleries are private links; account pages are per user.
    rules: { userAgent: "*", allow: "/", disallow: ["/s/", "/e/", "/account", "/app/", "/api/", "/auth/"] },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
