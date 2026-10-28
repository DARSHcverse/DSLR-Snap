import type { Metadata } from "next";
import { site } from "./site";

/**
 * A public page's metadata: canonical link, and share cards (og/twitter) with this page's own URL,
 * title and description. A page that sets only `title` would otherwise share the homepage's card,
 * because a child's openGraph replaces the layout's as a whole, image included, so the image from
 * app/opengraph-image.tsx is named here too.
 */
const SHARE_IMAGE = { url: "/opengraph-image", width: 1200, height: 630, alt: site.title };

export function pageMetadata({ title, description, path }: { title: string; description: string; path: string }): Metadata {
  const shareTitle = `${title} · ${site.name}`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { type: "website", siteName: site.name, url: path, title: shareTitle, description, images: [SHARE_IMAGE] },
    twitter: { card: "summary_large_image", title: shareTitle, description, images: [SHARE_IMAGE.url] },
  };
}
