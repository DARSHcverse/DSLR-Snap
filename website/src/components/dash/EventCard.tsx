import { BarChart3, ImageOff, Lock, Settings2 } from "lucide-react";
import Link from "next/link";
import type { CloudEventCard } from "@/lib/cloudEvents";

export const eventDay = (t: string | number | null, month: "short" | "long" = "long") =>
  t ? new Date(typeof t === "string" && t.length === 10 ? `${t}T12:00:00Z` : t).toLocaleDateString("en-GB", { day: "numeric", month, year: "numeric" }) : null;

/** An event is "happening now" on its date, or while photos are still arriving (the last 12 hours). */
export function isLive(e: Pick<CloudEventCard, "date" | "lastActivity">, now = Date.now()): boolean {
  const today = new Date(now).toLocaleDateString("en-CA", { timeZone: "Europe/London" });
  return e.date === today || (!!e.lastActivity && now - Date.parse(e.lastActivity) < 12 * 3_600_000);
}

/** A photo card for an event: cover, name, date and count, with quick links to its settings. */
export function EventCard({ e, live }: { e: CloudEventCard; live?: boolean }) {
  return (
    <div className="group relative">
      <Link href={`/account/events/${e.id}`} className="block overflow-hidden rounded-2xl border border-line bg-surface transition-all hover:-translate-y-0.5 hover:border-accent/60 hover:shadow-xl hover:shadow-black/30">
        <div className="relative aspect-square overflow-hidden bg-surface-2">
          {e.cover ? (
            // eslint-disable-next-line @next/next/no-img-element -- short-lived signed storage URL
            <img src={e.cover} alt="" loading="lazy" className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
          ) : (
            <div className="flex size-full flex-col items-center justify-center gap-2 text-muted">
              <ImageOff className="size-10 opacity-50" strokeWidth={1.5} aria-hidden />
              <span className="text-xs">No photos yet</span>
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/50 to-transparent" />
          <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
            {live && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
                <span className="size-1.5 animate-pulse rounded-full bg-ok" /> Live
              </span>
            )}
            {e.passwordSet && <span className="inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[11px] text-white backdrop-blur"><Lock className="size-3" aria-hidden /> Password</span>}
            {!e.linkEnabled && <span className="rounded-full bg-black/60 px-2 py-1 text-[11px] text-white backdrop-blur">Link off</span>}
          </div>
          <span className="absolute right-3 bottom-3 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
            {e.sessions} {e.sessions === 1 ? "session" : "sessions"}
          </span>
        </div>
        <div className="px-4 py-3.5">
          <p className="truncate font-semibold">{e.name}</p>
          <p className="mt-0.5 text-sm text-muted">{eventDay(e.date ?? e.lastActivity) ?? "No date"}</p>
        </div>
      </Link>
      <div className="absolute top-3 right-3 flex gap-1.5 opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
        <Link href={`/account/events/${e.id}/settings`} className="rounded-full bg-black/60 p-2 text-white backdrop-blur hover:bg-black/80" aria-label={`${e.name} settings`} title="Settings">
          <Settings2 className="size-4" />
        </Link>
        <Link href={`/account/events/${e.id}/analytics`} className="rounded-full bg-black/60 p-2 text-white backdrop-blur hover:bg-black/80" aria-label={`${e.name} analytics`} title="Analytics">
          <BarChart3 className="size-4" />
        </Link>
      </div>
    </div>
  );
}
