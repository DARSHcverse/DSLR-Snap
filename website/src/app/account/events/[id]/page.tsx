import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";
import { Suspense } from "react";
import { NotReady } from "@/components/PageShell";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { inputClass } from "@/components/ui";
import { designForEvent } from "@/lib/cloudDesign";
import { getEvent, sessionsForOwner } from "@/lib/cloudEvents";
import { accountsEnabled, appUrl } from "@/lib/config";
import { isUuid } from "@/lib/gallery";
import { getCurrentUser } from "@/lib/supabase/server";
import { deleteWholeEvent, replaceLink, saveEventSettings } from "./actions";
import { CopyLink } from "./CopyLink";
import { DesignEditor } from "./DesignEditor";
import { PhotoUpload } from "./PhotoUpload";
import { SessionGrid } from "./SessionGrid";

export const metadata: Metadata = { title: "Event", robots: { index: false } };

/** One event in DSLR Snap Cloud: share it, set who sees what, manage its photos. */
export default function EventPage({ params, searchParams }: PageProps<"/account/events/[id]">) {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        {accountsEnabled ? (
          <Suspense fallback={<p className="text-muted">Loading the event…</p>}>
            <Event params={params} searchParams={searchParams} />
          </Suspense>
        ) : (
          <NotReady />
        )}
      </main>
      <Footer />
    </>
  );
}

const toggle = (name: string, label: string, hint: string, on: boolean) => (
  <label className="flex gap-3 py-2">
    <input type="checkbox" name={name} defaultChecked={on} className="mt-1 size-4 shrink-0 accent-[var(--color-accent)]" />
    <span>
      <span className="block text-sm font-medium text-fg">{label}</span>
      <span className="block text-xs text-muted">{hint}</span>
    </span>
  </label>
);

async function Event({ params, searchParams }: PageProps<"/account/events/[id]">) {
  const user = await getCurrentUser();
  const { id } = await params;
  if (!user) redirect(`/login?next=/account/events/${id}`);
  const event = isUuid(id) ? await getEvent(user.id, id) : null;
  if (!event) notFound();
  const { done } = await searchParams;
  const sessions = await sessionsForOwner(event.id);
  const link = `${appUrl}/e/${event.shareToken}`;
  const qr = await QRCode.toDataURL(link, { margin: 1, width: 360, color: { dark: "#16161d", light: "#ffffff" } });
  const hidden = sessions.filter((s) => s.hidden).length;
  const look = await designForEvent(user.id, event.design);
  const { tab } = await searchParams;
  const field = "flex flex-col gap-1 text-sm text-muted";

  return (
    <div className="flex flex-col gap-6">
      <Link href="/account/events" className="text-sm text-muted hover:text-fg">← Your events</Link>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{event.name}</h1>
          <p className="mt-1 text-muted">
            {sessions.length - hidden} in the gallery{hidden ? ` · ${hidden} hidden` : ""} · {event.linkEnabled ? (event.passwordSet ? "link on, with password" : "link on") : "link off"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={link} target="_blank" rel="noopener" className="rounded-full border border-line px-4 py-2 text-sm font-semibold hover:bg-surface-2">View gallery ↗</a>
          <a href={`/e/${event.shareToken}/slideshow`} target="_blank" rel="noopener" className="rounded-full border border-line px-4 py-2 text-sm font-semibold hover:bg-surface-2">Slideshow ↗</a>
          <CopyLink url={link} />
          <PhotoUpload eventId={event.id} />
          {sessions.length > 0 && <a href={`/account/events/${event.id}/download`} className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-ink">Download all (zip)</a>}
        </div>
      </div>
      {typeof done === "string" && <p className="rounded-xl border border-ok/40 bg-ok/10 px-4 py-3 text-sm">{done}</p>}

      <details id="design" open={tab === "design"} className="rounded-card border border-line bg-surface p-5">
        <summary className="cursor-pointer font-semibold">Edit design <span className="font-normal text-muted">· colours, font, banner, logo and background for this gallery</span></summary>
        <div className="mt-5">
          <DesignEditor
            eventId={event.id}
            eventName={event.name}
            initial={look.design}
            images={look.images}
            samples={sessions.filter((s) => !s.hidden).slice(0, 6).map((s) => s.photo)}
            custom={!!event.design}
          />
        </div>
      </details>

      <div className="grid items-start gap-6 lg:grid-cols-[300px_1fr]">
        <aside className="flex flex-col gap-5 lg:sticky lg:top-20">
          <form action={saveEventSettings} className="rounded-card border border-line bg-surface p-5">
            <input type="hidden" name="event" value={event.id} />
            <h2 className="font-semibold">Event settings</h2>
            <div className="mt-3 flex flex-col gap-3">
              <label className={field}>Event name<input name="name" defaultValue={event.name} maxLength={120} className={inputClass} /></label>
              <label className={field}>Event date<input type="date" name="date" defaultValue={event.date ?? ""} className={inputClass} /></label>
            </div>
            <div className="mt-2 divide-y divide-line/60">
              {toggle("showDate", "Show the date", "On the gallery page", event.showDate)}
              {toggle("linkEnabled", "Link sharing", "Anyone with the link can see this gallery", event.linkEnabled)}
              {toggle("guestAccess", "Guests see everyone's photos", "A guest's QR page links to the whole event", event.guestAccess === "all")}
              {toggle("allowDownloadAll", "Download all", "Visitors can download the whole event as a zip", event.allowDownloadAll)}
            </div>
            <div className="mt-3 flex flex-col gap-3">
              <label className={field}>
                Password {event.passwordSet && <span className="text-xs text-ok">(set)</span>}
                <input name="password" type="text" autoComplete="off" placeholder={event.passwordSet ? "Type a new one to change it" : "Leave empty for none"} className={inputClass} />
              </label>
              {event.passwordSet && (
                <label className="flex items-center gap-2 text-sm text-muted"><input type="checkbox" name="removePassword" value="1" className="accent-[var(--color-accent)]" /> Remove the password</label>
              )}
              <label className={field}>Your website<input name="website" defaultValue={event.website ?? ""} placeholder="yourbooth.co.uk" className={inputClass} /></label>
            </div>
            <button className="mt-4 w-full rounded-full bg-accent px-4 py-2.5 font-semibold text-accent-ink">Save settings</button>
          </form>

          <section className="rounded-card border border-line bg-surface p-5">
            <h2 className="font-semibold">Share with the client</h2>
            {/* eslint-disable-next-line @next/next/no-img-element -- generated data URL */}
            <img src={qr} alt="QR code for the event gallery" className="mx-auto mt-3 w-40 rounded-lg" />
            <p className="mt-3 break-all text-xs text-muted">{link}</p>
            <a href={qr} download={`${event.name} gallery QR.png`} className="mt-3 block text-center text-sm text-accent hover:underline">Download QR image</a>
            <form action={replaceLink} className="mt-3 text-center">
              <input type="hidden" name="event" value={event.id} />
              <button className="text-xs text-muted hover:text-fg">Make a new link (the old one stops working)</button>
            </form>
          </section>

          <details className="rounded-card border border-bad/30 p-5">
            <summary className="cursor-pointer text-sm font-semibold text-bad">Delete this event from the cloud</summary>
            <p className="mt-2 text-xs text-muted">Removes every photo and video of this event from DSLR Snap Cloud, and all its links stop working. The copies on your booth computer stay.</p>
            <form action={deleteWholeEvent} className="mt-3 flex flex-col gap-2">
              <input type="hidden" name="event" value={event.id} />
              <input name="confirm" autoComplete="off" placeholder="Type the event name" className={inputClass} />
              <button className="rounded-full border border-bad/60 px-4 py-2 text-sm font-semibold text-bad hover:bg-bad/10">Delete event</button>
            </form>
          </details>
        </aside>

        <SessionGrid eventId={event.id} sessions={sessions} coverId={event.coverSessionId} />
      </div>
    </div>
  );
}
