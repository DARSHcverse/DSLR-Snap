import type { Metadata } from "next";
import { Suspense } from "react";
import { GalleryNotice, GalleryShell } from "@/components/gallery/GalleryShell";
import { RefreshWhileWaiting } from "@/components/gallery/RefreshWhileWaiting";
import { accountsEnabled } from "@/lib/config";
import { isUuid } from "@/lib/gallery";
import { loadSessionGallery } from "@/lib/galleryServer";

export const metadata: Metadata = { title: "Your photos · DSLR Snap", robots: { index: false, follow: false } };

/** A guest's photos from one booth session: the link in the QR code. */
export default function SessionPage({ params }: PageProps<"/s/[id]">) {
  return (
    <GalleryShell>
      <Suspense fallback={<p className="py-16 text-center text-muted">Loading your photos…</p>}>
        <Session params={params} />
      </Suspense>
    </GalleryShell>
  );
}

async function Session({ params }: Pick<PageProps<"/s/[id]">, "params">) {
  const { id } = await params;
  if (!accountsEnabled || !isUuid(id)) {
    return <GalleryNotice title="Photos not found" body="Check the link, or scan the QR code at the booth again." />;
  }
  const gallery = await loadSessionGallery(id);
  if (gallery.state === "waiting") {
    return (
      <GalleryNotice title="Your photos are on their way" body="The booth is uploading them now. Keep this page open, or come back to the link later.">
        <RefreshWhileWaiting />
      </GalleryNotice>
    );
  }
  if (gallery.state === "expired") {
    return <GalleryNotice title="These photos have expired" body="Booth photos stay online for a year. Ask the photo booth company if you need a copy." />;
  }

  const items = gallery.items.filter((i) => i.view);
  return (
    <>
      <header className="text-center">
        <p className="text-sm font-semibold tracking-[0.2em] text-accent uppercase">{gallery.eventName ?? "Photo booth"}</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-[-0.02em] sm:text-4xl">Your photos</h1>
        <p className="mt-2 text-muted">Tap Download to save. On iPhone you can also press and hold a photo.</p>
      </header>
      <div className={`mt-10 grid gap-6 ${items.length > 1 ? "sm:grid-cols-2" : "mx-auto max-w-md"}`}>
        {items.map((l) => (
          <figure key={l.kind} className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4">
            {l.video ? (
              <video src={l.view} autoPlay muted loop playsInline className="mx-auto max-h-[70vh] w-auto rounded-lg" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- short-lived signed storage URL
              <img src={l.view} alt={l.label} className="mx-auto max-h-[70vh] w-auto rounded-lg" />
            )}
            <figcaption className="flex items-center justify-between gap-3">
              <span className="font-medium">{l.label}</span>
              <a href={l.download} className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink transition-transform active:scale-[0.97]">
                Download
              </a>
            </figcaption>
          </figure>
        ))}
      </div>
    </>
  );
}
