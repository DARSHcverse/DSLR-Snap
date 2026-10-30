import { Globe, Images, SearchX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EventCard, isLive } from "@/components/dash/EventCard";
import { btn, EmptyState, PageHeader } from "@/components/dash/ui";
import { listEvents } from "@/lib/cloudEvents";
import { requireDashboardUser } from "@/lib/dashboard";
import { CreateEventCard } from "./CreateEventCard";

export const metadata: Metadata = { title: "Events" };

const SORTS = { newest: "Newest", oldest: "Oldest", photos: "Most photos", name: "Name" } as const;
type Sort = keyof typeof SORTS;

/** DSLR Snap Cloud: every event the operator's booths uploaded, as photo cards. */
export default function EventsPage({ searchParams }: PageProps<"/account/events">) {
  return (
    <>
      <PageHeader
        title="Events"
        intro="Every event your booths have uploaded. Open one to share it, change who can see it, or download everything."
        actions={<Link href="/account/homepage" className={btn}><Globe className="size-4" /> Your homepage</Link>}
      />
      <Suspense fallback={<Skeleton />}>
        <Events searchParams={searchParams} />
      </Suspense>
    </>
  );
}

const grid = "grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5";

async function Events({ searchParams }: Pick<PageProps<"/account/events">, "searchParams">) {
  const user = await requireDashboardUser("/account/events");
  const sp = await searchParams;
  const q = String(sp.q ?? "").trim();
  const sort: Sort = (Object.keys(SORTS) as Sort[]).find((k) => k === sp.sort) ?? "newest";
  const all = await listEvents(user.id);
  let events = q ? all.filter((e) => e.name.toLowerCase().includes(q.toLowerCase())) : all;
  if (sort === "oldest") events = [...events].reverse();
  if (sort === "photos") events = [...events].sort((a, b) => b.sessions - a.sessions);
  if (sort === "name") events = [...events].sort((a, b) => a.name.localeCompare(b.name));
  const live = events.filter((e) => isLive(e));
  const past = events.filter((e) => !live.includes(e));
  const link = (s: Sort) => `/account/events?${new URLSearchParams({ ...(q ? { q } : {}), sort: s })}`;

  return (
    <div className="flex flex-col gap-10">
      {/* Phones have no search in the top bar. */}
      <form className="sm:hidden" role="search">
        <input name="q" type="search" defaultValue={q} placeholder="Search events" aria-label="Search events" className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm" />
      </form>

      {q ? (
        <p className="-mb-4 text-sm text-muted">
          {events.length} {events.length === 1 ? "event matches" : "events match"} “{q}” · <Link href="/account/events" className="text-accent hover:underline">Clear search</Link>
        </p>
      ) : (
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            Happening now {live.length > 0 && <span className="size-2 animate-pulse rounded-full bg-ok" aria-hidden />}
          </h2>
          <ul className={grid}>
            <li><CreateEventCard startOpen={sp.new === "1"} /></li>
            {live.map((e) => <li key={e.id}><EventCard e={e} live /></li>)}
          </ul>
        </section>
      )}

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{q ? "Results" : "Past events"} <span className="font-normal text-muted">{q ? events.length : past.length}</span></h2>
          <nav className="flex flex-wrap gap-1 rounded-xl border border-line bg-surface p-1 text-sm" aria-label="Sort events">
            {(Object.keys(SORTS) as Sort[]).map((s) => (
              <Link key={s} href={link(s)} aria-current={s === sort ? "true" : undefined} className={`rounded-lg px-3 py-1.5 ${s === sort ? "bg-surface-2 font-semibold text-fg" : "text-muted hover:text-fg"}`}>{SORTS[s]}</Link>
            ))}
          </nav>
        </div>
        {(q ? events : past).length ? (
          <ul className={grid}>
            {(q ? events : past).map((e) => <li key={e.id}><EventCard e={e} live={isLive(e)} /></li>)}
          </ul>
        ) : q ? (
          <EmptyState icon={SearchX} title={`No events match “${q}”`}>Try part of the couple&apos;s names or the venue.</EmptyState>
        ) : (
          <EmptyState icon={Images} title={all.length ? "No past events yet" : "No events in the cloud yet"}>
            {all.length
              ? "Events move here once the day is over."
              : "Turn on QR downloads for an event in DSLR Snap. Photos upload as guests use the booth (or later, if the venue has no Wi-Fi), and the event appears here."}
          </EmptyState>
        )}
      </section>
    </div>
  );
}

function Skeleton() {
  return (
    <ul className={grid} aria-busy="true">
      {Array.from({ length: 8 }, (_, i) => (
        <li key={i}>
          <div className="aspect-square animate-pulse rounded-2xl bg-surface-2/50" />
          <div className="mt-3 h-4 w-2/3 animate-pulse rounded bg-surface-2/50" />
        </li>
      ))}
    </ul>
  );
}
