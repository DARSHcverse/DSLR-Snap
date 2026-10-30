import { BarChart3, CalendarClock, CreditCard, Download, ExternalLink, Globe, Images, LifeBuoy, Monitor, Plus, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { BarChart } from "@/components/admin/BarChart";
import { EventCard, eventDay, isLive } from "@/components/dash/EventCard";
import { ActionRow, btn, btnPrimary, EmptyState, Meter, PageHeader, Panel, Pill, StatCard } from "@/components/dash/ui";
import { devicesFor } from "@/lib/account";
import { deviceLimit } from "@/lib/appAuth";
import { listEvents } from "@/lib/cloudEvents";
import { appUrl } from "@/lib/config";
import { planLabel, requireDashboardUser } from "@/lib/dashboard";
import { statsForUser } from "@/lib/galleryStats";

export const metadata: Metadata = { title: "Overview" };

export default function OverviewPage({ searchParams }: PageProps<"/account">) {
  return (
    <Suspense>
      <Overview searchParams={searchParams} />
    </Suspense>
  );
}

function greeting(): string {
  const h = Number(new Date().toLocaleString("en-GB", { hour: "numeric", hour12: false, timeZone: "Europe/London" }));
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

async function Overview({ searchParams }: Pick<PageProps<"/account">, "searchParams">) {
  const user = await requireDashboardUser("/account");
  const sp = await searchParams;
  // Old links (emails, the app) still point at /account for the plan; send them to its new page.
  if (sp.checkout || sp.plan || sp.error) {
    redirect(`/account/billing?${new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : [])))}`);
  }
  const [events, devices, stats] = await Promise.all([listEvents(user.id), devicesFor(user.id), statsForUser(user.id, 30)]);
  const limit = deviceLimit(user.ent);
  const live = events.filter((e) => isLive(e));
  const sessions = events.reduce((n, e) => n + e.sessions, 0);
  const recent = [...live, ...events.filter((e) => !live.includes(e))].slice(0, 4);
  const homepageUrl = user.homepage?.enabled ? `${appUrl}/b/${user.homepage.slug}` : null;

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${user.displayName}`}
        intro="Your events, galleries and booths in one place."
        actions={
          <>
            {homepageUrl && <a href={homepageUrl} target="_blank" rel="noopener" className={btn}><ExternalLink className="size-4" /> View homepage</a>}
            <Link href="/account/events" className={btnPrimary}><Images className="size-4" /> All events</Link>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard icon={Images} label="Events in the cloud" value={events.length} sub={live.length ? <span className="text-ok">{live.length} happening now</span> : "None happening now"} href="/account/events" />
        <StatCard icon={Sparkles} tone="violet" label="Guest sessions" value={sessions.toLocaleString("en-GB")} sub="Across every event" href="/account/events" />
        <StatCard icon={BarChart3} tone="blue" label="Gallery views (30 days)" value={stats.views.toLocaleString("en-GB")} sub={`${stats.downloads.toLocaleString("en-GB")} downloads`} />
        <StatCard icon={Monitor} tone="green" label="Booth computers" value={`${devices.length} of ${limit}`} href="/account/computers">
          <Meter value={devices.length} max={limit} />
        </StatCard>
      </div>

      <div className="mt-6 grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel title="Recent events" action={events.length > 0 && <Link href="/account/events" className="text-sm font-semibold text-accent hover:underline">View all</Link>}>
            {recent.length ? (
              <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {recent.map((e) => <li key={e.id}><EventCard e={e} live={live.includes(e)} /></li>)}
              </ul>
            ) : (
              <EmptyState icon={Images} title="No events yet" action={<a href="/download" className={btnPrimary}><Download className="size-4" /> Download DSLR Snap</a>}>
                Turn on QR downloads for an event in DSLR Snap. Photos upload as guests use the booth, and the event appears here.
              </EmptyState>
            )}
          </Panel>
          <BarChart
            title="Gallery views per day (last 30 days)"
            bars={stats.days.map((d) => ({ label: new Date(`${d.day}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short" }), value: d.views, display: `${d.views} views` }))}
            empty="No visits yet. Views appear here once you share a gallery."
          />
        </div>

        <div className="flex flex-col gap-6">
          <Panel title="Your plan" action={<Pill tone={user.ent.active ? "ok" : "amber"}>{user.ent.active ? "Active" : "Trial"}</Pill>}>
            <p className="font-display text-xl font-bold">{planLabel(user)}</p>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
              <CalendarClock className="size-4" aria-hidden />
              {user.ent.active
                ? user.ent.periodEnd
                  ? `${user.ent.cancelAtPeriodEnd ? "Ends" : "Renews"} on ${eventDay(user.ent.periodEnd)}`
                  : "No end date"
                : "Everything works, with a small watermark"}
            </p>
            <Link href="/account/billing" className={`${user.ent.active ? btn : btnPrimary} mt-4 w-full`}>
              <CreditCard className="size-4" /> {user.ent.active ? "Manage plan" : "Choose a plan"}
            </Link>
          </Panel>

          <div className="flex flex-col gap-3">
            <h2 className="px-1 font-semibold">Quick actions</h2>
            <ActionRow icon={Globe} tone="violet" title={user.homepage ? "Edit your homepage" : "Set up your homepage"} hint="Your galleries and a Book now button" href="/account/homepage" />
            <ActionRow icon={Plus} tone="green" title="Add a booth computer" hint="Sign in from DSLR Snap on the booth" href="/account/computers" />
            <ActionRow icon={Download} tone="blue" title="Download DSLR Snap" hint="For Windows laptops, Surface and touch screens" href="/download" external />
            <ActionRow icon={LifeBuoy} title="Help & chat" hint={user.unread ? `${user.unread} new ${user.unread === 1 ? "reply" : "replies"}` : "We usually reply within a day"} href="/account/support" />
          </div>
        </div>
      </div>
    </>
  );
}
