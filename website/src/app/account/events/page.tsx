import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { NotReady, PageShell } from "@/components/PageShell";
import { inputClass } from "@/components/ui";
import { listEvents } from "@/lib/cloudEvents";
import { accountsEnabled } from "@/lib/config";
import { getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Your events", robots: { index: false } };

const day = (t: string | number | null) => (t ? new Date(typeof t === "string" && t.length === 10 ? `${t}T12:00:00Z` : t).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : null);

/** DSLR Snap Cloud: every event the operator's booths uploaded, newest first. */
export default function EventsPage({ searchParams }: PageProps<"/account/events">) {
  return (
    <PageShell title="Your events" intro="Every event your booths have uploaded, with all its photos and videos. Share a gallery with the client, change who can see it, or download everything." wide>
      {accountsEnabled ? (
        <Suspense fallback={<p className="text-muted">Loading your events…</p>}>
          <Events searchParams={searchParams} />
        </Suspense>
      ) : (
        <NotReady />
      )}
    </PageShell>
  );
}

async function Events({ searchParams }: Pick<PageProps<"/account/events">, "searchParams">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account/events");
  const q = String((await searchParams).q ?? "").trim().toLowerCase();
  const all = await listEvents(user.id);
  const events = q ? all.filter((e) => e.name.toLowerCase().includes(q)) : all;

  if (!all.length) {
    return (
      <div className="rounded-card border border-line bg-surface p-8 text-center">
        <p className="font-semibold">No events in the cloud yet</p>
        <p className="mt-2 text-muted">Turn on QR downloads for an event in DSLR Snap. Photos upload as guests use the booth (or later, if the venue has no Wi-Fi), and the event appears here.</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
      <form className="flex max-w-md gap-2">
        <input name="q" defaultValue={q} placeholder="Search events" className={inputClass} />
        <button className="rounded-xl border border-line px-4 text-sm font-semibold hover:bg-surface-2">Search</button>
      </form>
      <Link href="/account/homepage" className="text-sm text-accent hover:underline">Your public homepage →</Link>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {events.map((e) => (
          <li key={e.id}>
            <Link href={`/account/events/${e.id}`} className="group block overflow-hidden rounded-card border border-line bg-surface transition-colors hover:border-accent">
              <div className="aspect-[4/3] bg-surface-2">
                {e.cover ? (
                  // eslint-disable-next-line @next/next/no-img-element -- short-lived signed storage URL
                  <img src={e.cover} alt="" loading="lazy" className="size-full object-cover transition-transform group-hover:scale-[1.02]" />
                ) : (
                  <div className="flex size-full items-center justify-center text-sm text-muted">No photos yet</div>
                )}
              </div>
              <div className="p-4">
                <p className="truncate font-semibold">{e.name}</p>
                <p className="mt-1 text-sm text-muted">
                  {[day(e.date), `${e.sessions} guest${e.sessions === 1 ? "" : "s"}`, e.hidden ? `${e.hidden} hidden` : null].filter(Boolean).join(" · ")}
                </p>
                <p className="mt-2 flex flex-wrap gap-1.5 text-xs">
                  {!e.linkEnabled && <span className="rounded-full border border-line px-2 py-0.5 text-muted">Link off</span>}
                  {e.passwordSet && <span className="rounded-full border border-line px-2 py-0.5 text-muted">Password</span>}
                  {e.firstExpiry && <span className="rounded-full border border-line px-2 py-0.5 text-muted">Kept until {day(e.firstExpiry)}</span>}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      {!events.length && <p className="text-muted">No events match “{q}”.</p>}
    </div>
  );
}
