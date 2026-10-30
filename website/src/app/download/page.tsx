import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import Link from "next/link";
import { ContentPage, JsonLd } from "@/components/ContentPage";
import { Icon } from "@/components/Icon";
import { primaryButton, secondaryButton } from "@/components/ui";
import { latestRelease } from "@/lib/downloads";
import { launch, site, siteUrl } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Download DSLR Snap for Windows",
  description:
    "Download DSLR Snap free for Windows 10 and 11, on Surface Pro, tablets, touch PCs and laptops. Every feature works in the trial, with a small watermark until you choose a plan.",
  path: "/download",
});

const STEPS = [
  { title: "Install", body: "Run the installer. If Windows shows \"Windows protected your PC\", choose More info → Run anyway." },
  { title: "Plug in", body: "Connect your Canon or Nikon camera and DNP printer by USB. Home shows a green tick for each." },
  { title: "Try everything", body: "Every booth type and feature works in the free trial, with a small watermark on photos." },
  { title: "Sign in", body: "Choose a plan, then sign in under Account in the app to remove the watermark." },
];

const mb = (bytes: number) => `${Math.round(bytes / 1048576)} MB`;
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

export default async function DownloadPage() {
  const release = await latestRelease();
  return (
    <ContentPage
      eyebrow="Download"
      title="Download DSLR Snap"
      intro="Free to try, with no time limit. Every feature works; photos carry a small watermark until you choose a plan."
      narrow
    >
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: site.name,
          operatingSystem: "Windows 10, Windows 11",
          applicationCategory: "MultimediaApplication",
          url: `${siteUrl}/download`,
          ...(release ? { softwareVersion: release.version, downloadUrl: release.url, ...(release.sizeBytes ? { fileSize: mb(release.sizeBytes) } : {}) } : {}),
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD", description: "Free trial with a watermark" },
        }}
      />
      <div className="rounded-card border border-line bg-surface p-6 sm:p-8">
        <div className="flex items-center gap-2 text-sm text-muted">
          <Icon name="windows" className="size-4 text-accent" />
          Windows 10 or 11, 64-bit
        </div>
        {release ? (
          <>
            <a href={release.url} className={`${primaryButton} mt-5 w-full sm:w-auto`} download>
              Download for Windows
            </a>
            <p className="mt-3 text-sm text-muted">
              Version {release.version}
              {release.sizeBytes ? ` · ${mb(release.sizeBytes)}` : ""}
              {release.releasedAt ? ` · ${day(release.releasedAt)}` : ""}. Updates install by themselves, never during an event.
            </p>
          </>
        ) : (
          <>
            <p className="mt-5 inline-flex rounded-full bg-accent px-2.5 py-0.5 text-xs font-bold tracking-wider text-accent-ink uppercase">Coming soon</p>
            <p className="mt-3 text-lg font-semibold">DSLR Snap launches {launch.date}.</p>
            <p className="mt-2 text-muted">Create your free account now; the download appears on this page on launch day and we&apos;ll email you when it&apos;s out.</p>
            <Link href="/signup" className={`${primaryButton} mt-5`}>Create a free account</Link>
          </>
        )}
      </div>

      <h2 className="mt-14 font-display text-2xl font-bold">What you need</h2>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {[
          "A Windows 10 or 11 device: Surface Pro, Windows tablet, all-in-one touch PC or laptop. A touch screen works best.",
          "A Canon camera, or a Nikon Z (beta), connected by USB. Or a GoPro HERO9–12 for 360, or any webcam for the video guestbook.",
          "A DNP dye-sub printer such as the DS-RX1HS for 4×6 prints and 2×6 strips (optional).",
          "Internet only for QR downloads and your licence check; the booth itself works offline.",
        ].map((t) => (
          <li key={t} className="flex gap-3 rounded-card border border-line bg-surface p-5 text-muted">
            <Icon name="check" className="mt-0.5 size-5 shrink-0 text-ok" />
            {t}
          </li>
        ))}
      </ul>

      <h2 className="mt-14 font-display text-2xl font-bold">Get started in minutes</h2>
      <ol className="mt-4 grid gap-3 sm:grid-cols-2">
        {STEPS.map((s, i) => (
          <li key={s.title} className="rounded-card border border-line bg-surface p-5">
            <p className="text-sm font-semibold text-accent">Step {i + 1}</p>
            <p className="mt-1 font-semibold">{s.title}</p>
            <p className="mt-1 text-muted">{s.body}</p>
          </li>
        ))}
      </ol>

      <div className="mt-14 flex flex-wrap gap-3">
        <Link href="/pricing" className={secondaryButton}>See pricing</Link>
        <Link href="/support" className={secondaryButton}>Setup help</Link>
      </div>
    </ContentPage>
  );
}
