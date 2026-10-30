import { ArrowRight, CalendarDays, ChevronLeft, ExternalLink, Link2, Lock, QrCode } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { eventDay, isLive } from "@/components/dash/EventCard";
import { IconChip, Pill } from "@/components/dash/ui";
import { statsForEvent } from "@/lib/galleryStats";
import { toggleLinkSharing } from "./actions";
import { CopyLink } from "./CopyLink";
import { ownedEvent } from "./data";
import { DoneNotice, EventTabs } from "./EventTabs";

/** One event's workspace: its name, summary cards and section tabs, around the section's page. */
export default function EventLayout({ params, children }: LayoutProps<"/account/events/[id]">) {
  return (
    <Suspense fallback={<HeaderSkeleton />}>
      <EventFrame params={params}>{children}</EventFrame>
    </Suspense>
  );
}

async function EventFrame({ params, children }: Pick<LayoutProps<"/account/events/[id]">, "params" | "children">) {
  const { id } = await params;
  const { event, sessions, link } = await ownedEvent(id);
  const stats = await statsForEvent(event.id, 30);
  const hidden = sessions.filter((s) => s.hidden).length;
  const videos = sessions.filter((s) => s.video).length;
  const live = isLive({ date: event.date, lastActivity: sessions[0]?.createdAt ?? null });
  const num = (n: number) => n.toLocaleString("en-GB");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link href="/account/events" className="mb-2 inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
            <ChevronLeft className="size-4" aria-hidden /> All events
          </Link>
          <h1 className="font-display text-2xl font-bold tracking-[-0.02em] text-balance sm:text-3xl">{event.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
            <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-4" aria-hidden /> {eventDay(event.date) ?? "No date"}</span>
            <Link href={`/account/events/${event.id}/settings`} className="text-accent hover:underline">Edit</Link>
            {live && <Pill tone="ok"><span className="size-1.5 animate-pulse rounded-full bg-ok" /> Live</Pill>}
            {event.passwordSet && <Pill><Lock className="size-3" aria-hidden /> Password</Pill>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={link} target="_blank" rel="noopener" className="inline-flex items-center gap-2 rounded-xl border border-line px-3.5 py-2 text-sm font-semibold transition-colors hover:bg-surface-2">
            <ExternalLink className="size-4" aria-hidden /> Preview gallery
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-line bg-surface p-5">
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              ["Sessions", sessions.length - hidden],
              ["Photos", sessions.length - videos],
              ["Videos", videos],
            ].map(([label, n]) => (
              <div key={label}>
                <p className="text-sm text-muted">{label}</p>
                <p className="mt-1 font-display text-3xl font-bold">{num(n as number)}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 flex items-center justify-between text-xs text-muted">
            <span>{hidden ? `${hidden} hidden from guests` : "All visible to guests"}</span>
            <Link href={`/account/events/${event.id}`} className="inline-flex items-center gap-1 font-semibold text-accent hover:underline">Photos <ArrowRight className="size-3" aria-hidden /></Link>
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-5">
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              ["Views", stats.totals.views + stats.totals.sessionViews],
              ["Visitors", stats.totals.visitors],
              ["Downloads", stats.totals.downloads + stats.totals.zips],
            ].map(([label, n]) => (
              <div key={label}>
                <p className="text-sm text-muted">{label}</p>
                <p className="mt-1 font-display text-3xl font-bold">{num(n as number)}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 flex items-center justify-between text-xs text-muted">
            <span>All time, no cookies</span>
            <Link href={`/account/events/${event.id}/analytics`} className="inline-flex items-center gap-1 font-semibold text-accent hover:underline">Analytics <ArrowRight className="size-3" aria-hidden /></Link>
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 font-semibold"><IconChip icon={Link2} tone={event.linkEnabled ? "green" : "rose"} className="size-8" /> Link sharing</p>
            <form action={toggleLinkSharing}>
              <input type="hidden" name="event" value={event.id} />
              <input type="hidden" name="on" value={event.linkEnabled ? "0" : "1"} />
              <button role="switch" aria-checked={event.linkEnabled} aria-label="Link sharing" className="flex items-center gap-2 text-xs font-semibold">
                <span className={`relative h-6 w-11 rounded-full transition-colors ${event.linkEnabled ? "bg-accent" : "bg-surface-2 ring-1 ring-line"}`}>
                  <span className={`absolute top-1 size-4 rounded-full bg-white shadow transition-all ${event.linkEnabled ? "left-6" : "left-1"}`} />
                </span>
                {event.linkEnabled ? "ON" : "OFF"}
              </button>
            </form>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className={`min-w-0 flex-1 truncate rounded-xl border border-line bg-bg px-3 py-2 text-xs ${event.linkEnabled ? "text-fg" : "text-muted line-through"}`}>{link.replace(/^https?:\/\//, "")}</span>
            <CopyLink url={link} label="Copy" className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-xs font-semibold hover:bg-surface-2" />
            <Link href={`/account/events/${event.id}/sharing`} className="shrink-0 rounded-xl border border-line p-2 hover:bg-surface-2" aria-label="QR code and sharing" title="QR code and sharing"><QrCode className="size-4" /></Link>
          </div>
        </div>
      </div>

      <EventTabs eventId={event.id} />
      <Suspense>
        <DoneNotice />
      </Suspense>
      {children}
    </div>
  );
}

function HeaderSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <div className="h-9 w-72 animate-pulse rounded-lg bg-surface-2/60" />
      <div className="grid gap-4 lg:grid-cols-3">
        {[0, 1, 2].map((i) => <div key={i} className="h-32 animate-pulse rounded-2xl bg-surface-2/40" />)}
      </div>
      <div className="h-11 animate-pulse rounded-lg bg-surface-2/30" />
    </div>
  );
}
