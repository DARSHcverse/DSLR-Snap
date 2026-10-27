import type { Metadata, Viewport } from "next";
import { site, siteUrl } from "@/lib/site";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: site.title, template: `%s · ${site.name}` },
  description: site.description,
  applicationName: site.name,
  keywords: [
    "photo booth software",
    "photo booth software for Windows",
    "DSLR photo booth",
    "Canon photo booth software",
    "DNP printer photo booth",
    "photo booth templates",
    "360 photo booth software",
    "glam booth software",
    "green screen photo booth software",
    "video guestbook software",
    "dslrBooth alternative",
  ],
  alternates: { canonical: "/" },
  // Google Search Console: set NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION (the "HTML tag" method's content value).
  verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION } : undefined,
  openGraph: {
    type: "website",
    url: "/",
    siteName: site.name,
    title: site.title,
    description: site.description,
  },
  twitter: {
    card: "summary_large_image",
    title: site.title,
    description: site.description,
  },
};

export const viewport: Viewport = {
  themeColor: "#0b0b0f",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full">
        {children}
        {/* Cookieless and anonymous, so no consent banner is needed. Active once deployed on Vercel. */}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
