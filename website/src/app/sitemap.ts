import type { MetadataRoute } from "next";
import { SOLUTIONS } from "@/lib/marketing";
import { siteUrl } from "@/lib/site";

/** Every public marketing page. Account, app sign-in and gallery pages are private and left out. */
export default function sitemap(): MetadataRoute.Sitemap {
  const page = (path: string, priority: number, changeFrequency: "weekly" | "monthly" | "yearly" = "monthly") => ({
    url: `${siteUrl}${path}`,
    changeFrequency,
    priority,
  });
  return [
    page("", 1, "weekly"),
    page("/features", 0.9),
    page("/pricing", 0.9),
    ...SOLUTIONS.map((s) => page(`/solutions/${s.slug}`, 0.8)),
    page("/compare/dslrbooth", 0.7),
    page("/support", 0.6),
    page("/signup", 0.5),
    page("/terms", 0.2, "yearly"),
    page("/privacy", 0.2, "yearly"),
    page("/refunds", 0.2, "yearly"),
  ];
}
