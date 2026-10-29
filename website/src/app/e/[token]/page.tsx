import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { GalleryNotice, GalleryShell } from "@/components/gallery/GalleryShell";
import { secondaryButton } from "@/components/ui";
import { accountsEnabled } from "@/lib/config";
import { isShareToken } from "@/lib/gallery";
import { after } from "next/server";
import { designForEvent } from "@/lib/cloudDesign";
import { recordHit, visitor } from "@/lib/galleryStats";
import { eventAlbums, eventSessions, publicEventByToken } from "@/lib/galleryServer";
import { hasAccess } from "./access";
import { Unlock } from "./Unlock";

export const metadata: Metadata = { title: "Event photos", robots: { index: false, follow: false } };

/** The host's page: every photo from the event, newest first. Each opens the session page to download. */
export default function EventGalleryPage({ params, searchParams }: PageProps<"/e/[token]">) {
  return (
    <Suspense fallback={<GalleryShell><p className="py-16 text-center text-muted">Loading the gallery…</p></GalleryShell>}>
      <EventGallery params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function EventGallery({ params, searchParams }: PageProps<"/e/[token]">) {
  const { token } = await params;
  const event = accountsEnabled && isShareToken(token) ? await publicEventByToken(token) : null;
  if (!event) return <GalleryShell><GalleryNotice title="Gallery not found" body="Check the link with your photo booth company." /></GalleryShell>;
  if (!event.linkEnabled) return <GalleryShell><GalleryNotice title="This gallery is private" body="The photo booth company has turned this link off. Ask them if you need the photos." /></GalleryShell>;
  const look = await designForEvent(event.userId, event.design);
  if (!(await hasAccess(event))) {
    return (
      <GalleryShell look={look}>
      <div className="py-12 text-center">
        <h1 className="font-display text-3xl font-bold tracking-tight">{event.name}</h1>
        <p className="mt-2 text-muted">This gallery has a password. You&apos;ll find it with the link you were sent.</p>
        <Unlock token={token} />
      </div>
      </GalleryShell>
    );
  }

  const albums = (await eventAlbums(event.id)).filter((a) => a.count > 0);
  const albumParam = (await searchParams).album;
  const album = albums.find((a) => a.id === albumParam) ?? null;
  const sessions = await eventSessions(event.id, album ? { album: album.id } : {});
  const who = await visitor();
  after(() => recordHit(event.id, "view", who));
  const date = event.date && event.showDate ? new Date(`${event.date}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : null;
  const n = sessions.length;
  return (
    <GalleryShell look={look}>
      <header className="text-center">
        <p className="text-sm font-semibold tracking-[0.2em] text-accent uppercase">Photo booth gallery</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-[-0.02em] text-balance sm:text-5xl">{event.name}</h1>
        <p className="mt-2 text-muted">{[date, `${n} session${n === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {event.allowDownloadAll && n > 0 && <a href={`/e/${token}/download`} className="rounded-full bg-accent px-5 py-2.5 font-semibold text-accent-ink transition-transform active:scale-[0.97]">Download all</a>}
          {event.website && <a href={event.website} target="_blank" rel="noopener" className={secondaryButton}>Photo booth by {new URL(event.website).hostname.replace(/^www\./, "")}</a>}
        </div>
      </header>
      {albums.length > 0 && (
        <nav className="mt-8 flex flex-wrap justify-center gap-2" aria-label="Albums">
          <Link href={`/e/${token}`} className={`rounded-full border px-4 py-1.5 text-sm ${!album ? "border-accent bg-accent text-accent-ink" : "border-line text-muted hover:text-fg"}`}>All</Link>
          {albums.map((a) => (
            <Link key={a.id} href={`/e/${token}?album=${a.id}`} className={`rounded-full border px-4 py-1.5 text-sm ${album?.id === a.id ? "border-accent bg-accent text-accent-ink" : "border-line text-muted hover:text-fg"}`}>
              {a.name}
            </Link>
          ))}
        </nav>
      )}
      {n ? (
        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {sessions.map((s) => (
            <Link key={s.id} href={`/s/${s.id}`} className="relative overflow-hidden rounded-xl border border-line bg-surface transition-transform active:scale-[0.98]">
              {s.video && <span className="absolute top-2 left-2 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold" aria-label="Video message">▶ Video</span>}
              {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed storage URL */}
              <img src={s.photo} alt="" loading="lazy" className="aspect-[2/3] w-full object-cover" />
            </Link>
          ))}
        </div>
      ) : (
        <p className="mt-10 text-center text-muted">No photos yet. They appear here as guests use the booth.</p>
      )}
    </GalleryShell>
  );
}
