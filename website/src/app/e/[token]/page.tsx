import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { GalleryNotice, GalleryShell } from "@/components/gallery/GalleryShell";
import { accountsEnabled } from "@/lib/config";
import { isShareToken } from "@/lib/gallery";
import { loadEventGallery } from "@/lib/galleryServer";

export const metadata: Metadata = { title: "Event photos · DSLR Snap", robots: { index: false, follow: false } };

/** The host's page: every photo from the event, newest first. Each opens the session page to download. */
export default function EventGalleryPage({ params }: PageProps<"/e/[token]">) {
  return (
    <GalleryShell>
      <Suspense fallback={<p className="py-16 text-center text-muted">Loading the gallery…</p>}>
        <EventGallery params={params} />
      </Suspense>
    </GalleryShell>
  );
}

async function EventGallery({ params }: Pick<PageProps<"/e/[token]">, "params">) {
  const { token } = await params;
  const gallery = accountsEnabled && isShareToken(token) ? await loadEventGallery(token) : null;
  if (!gallery) return <GalleryNotice title="Gallery not found" body="Check the link with your photo booth company." />;
  const date = gallery.date
    ? new Date(`${gallery.date}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : null;
  const n = gallery.sessions.length;

  return (
    <>
      <header className="text-center">
        <p className="text-sm font-semibold tracking-[0.2em] text-accent uppercase">Photo booth gallery</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-[-0.02em] text-balance sm:text-5xl">{gallery.name}</h1>
        <p className="mt-2 text-muted">{[date, `${n} session${n === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}</p>
      </header>
      {n ? (
        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {gallery.sessions.map((s) => (
            <Link key={s.id} href={`/s/${s.id}`} className="relative overflow-hidden rounded-xl border border-line bg-surface transition-transform active:scale-[0.98]">
              {s.video && (
                <span className="absolute top-2 left-2 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold" aria-label="Video message">▶ Video</span>
              )}
              {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed storage URL */}
              <img src={s.photo} alt="" loading="lazy" className="aspect-[2/3] w-full object-cover" />
            </Link>
          ))}
        </div>
      ) : (
        <p className="mt-10 text-center text-muted">No photos yet. They appear here as guests use the booth.</p>
      )}
    </>
  );
}
