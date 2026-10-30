import { Download, Laptop, LogIn, Monitor, Plus, Wifi, WifiOff } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { eventDay } from "@/components/dash/EventCard";
import { btn, btnPrimary, EmptyState, IconChip, Meter, PageHeader, Panel, Pill } from "@/components/dash/ui";
import { devicesFor } from "@/lib/account";
import { deviceLimit } from "@/lib/appAuth";
import { requireDashboardUser } from "@/lib/dashboard";
import { OFFLINE_GRACE_DAYS } from "@/lib/plans";
import { removeDevice } from "../actions";
import { ConfirmButton } from "@/components/dash/ConfirmButton";

export const metadata: Metadata = { title: "Booth computers" };

export default function ComputersPage() {
  return (
    <Suspense>
      <Computers />
    </Suspense>
  );
}

function seen(t: string | null) {
  if (!t) return { label: "Never online", online: false };
  const mins = (Date.now() - Date.parse(t)) / 60_000;
  if (mins < 15) return { label: "Online now", online: true };
  if (mins < 60 * 24) return { label: `Last online ${Math.round(mins / 60) || 1}h ago`, online: false };
  return { label: `Last online ${eventDay(t, "short")}`, online: false };
}

async function Computers() {
  const user = await requireDashboardUser("/account/computers");
  const devices = await devicesFor(user.id);
  const limit = deviceLimit(user.ent);

  return (
    <>
      <PageHeader
        title="Booth computers"
        intro={`The computers signed in to your account. Each one checks in when it's online and keeps working offline for ${OFFLINE_GRACE_DAYS} days.`}
        actions={devices.length >= limit && user.ent.active ? <Link href="/account/billing?tab=plan" className={btnPrimary}><Plus className="size-4" /> Add more computers</Link> : undefined}
      />

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Panel title={`${devices.length} of ${limit} in use`} description={devices.length >= limit ? "Every slot is taken. Remove one to sign in on another computer." : `${limit - devices.length} free ${limit - devices.length === 1 ? "slot" : "slots"}.`}>
          <Meter value={devices.length} max={limit} tone={devices.length >= limit ? "amber" : "accent"} />
          {devices.length ? (
            <ul className="mt-5 flex flex-col gap-3">
              {devices.map((d) => {
                const s = seen(d.last_seen_at);
                return (
                  <li key={d.id} className="flex flex-wrap items-center gap-4 rounded-2xl border border-line p-4">
                    <IconChip icon={Laptop} tone={s.online ? "green" : "blue"} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{d.name}</p>
                      <p className="mt-0.5 text-sm text-muted">Added {eventDay(d.created_at, "short")}</p>
                    </div>
                    <Pill tone={s.online ? "ok" : "muted"}>
                      {s.online ? <Wifi className="size-3" aria-hidden /> : <WifiOff className="size-3" aria-hidden />} {s.label}
                    </Pill>
                    <form action={removeDevice}>
                      <input type="hidden" name="id" value={d.id} />
                      <ConfirmButton message={`Remove ${d.name}? It drops to the free trial until it signs in again.`} className="rounded-xl px-3 py-2 text-sm font-semibold text-bad hover:bg-bad/10">Remove</ConfirmButton>
                    </form>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="mt-5">
              <EmptyState icon={Monitor} title="No computers yet" action={<a href="/download" className={btnPrimary}><Download className="size-4" /> Download DSLR Snap</a>}>
                Open DSLR Snap on your booth computer and press Sign in under Account.
              </EmptyState>
            </div>
          )}
        </Panel>

        <Panel title="Add a computer">
          <ol className="flex flex-col gap-4 text-sm">
            {[
              { icon: Download, text: "Install DSLR Snap on the booth computer, tablet or Surface." },
              { icon: LogIn, text: "Open it and press Sign in under Account. Your browser opens this website." },
              { icon: Monitor, text: "Approve the sign-in here. The computer appears in this list." },
            ].map(({ icon, text }, i) => (
              <li key={i} className="flex gap-3">
                <IconChip icon={icon} tone="violet" className="size-9" />
                <span className="pt-1.5 text-muted"><span className="font-semibold text-fg">Step {i + 1}.</span> {text}</span>
              </li>
            ))}
          </ol>
          <a href="/download" className={`${btn} mt-5 w-full`}><Download className="size-4" /> Download DSLR Snap</a>
        </Panel>
      </div>
    </>
  );
}
