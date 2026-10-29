import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { GalleryNotice, GalleryShell } from "@/components/gallery/GalleryShell";
import { secondaryButton } from "@/components/ui";
import { accountsEnabled } from "@/lib/config";
import { isShareToken } from "@/lib/gallery";
import { eventSessions, publicEventByToken } from "@/lib/galleryServer";
import { hasAccess } from "./access";
import { Unlock } from "./Unlock";

export const metadata: Metadata = { title: "Event photos", robots: { index: false, follow: false } };

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
  const event = accountsEnabled && isShareToken(token) ? await publicEventByToken(token) : null;
  if (!event) return <GalleryNotice title="Gallery not found" body="Check the link with your photo booth company." />;
  if (!event.linkEnabled) return <GalleryNotice title="This gallery is private" body="The photo booth company has turned this link off. Ask them if you need the photos." />;
  if (!(await hasAccess(event))) {
    return (
      <div className="py-12 text-center">
        <h1 className="font-display text-3xl font-bold tracking-tight">{event.name}</h1>
        <p className="mt-2 text-muted">This gallery has a password. You&apos;ll find it with the link you were sent.</p>
        <Unlock token={token} />
      </div>
    );
  }

  const sessions = await eventSessions(event.id);
  const date = event.date && event.showDate ? new Date(`${event.date}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : null;
  const n = sessions.length;
  return (
    <>
      <header className="text-center">
        <p className="text-sm font-semibold tracking-[0.2em] text-accent uppercase">Photo booth gallery</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-[-0.02em] text-balance sm:text-5xl">{event.name}</h1>
        <p className="mt-2 text-muted">{[date, `${n} session${n === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {event.allowDownloadAll && n > 0 && <a href={`/e/${token}/download`} className={secondaryButton}>Download all</a>}
          {event.website && <a href={event.website} target="_blank" rel="noopener" className={secondaryButton}>Photo booth by {new URL(event.website).hostname.replace(/^www\./, "")}</a>}
        </div>
      </header>
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
    </>
  );
}
