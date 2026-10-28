import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ago } from "@/components/admin/bits";
import { LiveRefresh } from "@/components/chat/LiveRefresh";
import { adminHref, requireAdmin } from "@/lib/admin/server";
import { inbox } from "@/lib/support";

export const metadata: Metadata = { title: "Support" };

export default function SupportInboxPage({ searchParams }: PageProps<"/admin/support">) {
  return (
    <>
      <h1 className="font-display text-3xl font-bold tracking-tight">Support</h1>
      <Suspense fallback={<p className="mt-6 text-muted">Loading…</p>}>
        <Inbox searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Inbox({ searchParams }: Pick<PageProps<"/admin/support">, "searchParams">) {
  await requireAdmin();
  const closed = (await searchParams).show === "closed";
  const threads = await inbox(closed ? "closed" : "open");
  return (
    <div className="mt-6 flex max-w-4xl flex-col gap-4">
      <LiveRefresh seconds={15} />
      <div className="flex gap-2">
        <Link href={adminHref("support")} className={`rounded-full border px-3 py-1 text-sm ${!closed ? "border-accent bg-accent/10" : "border-line text-muted"}`}>Open</Link>
        <Link href={adminHref("support?show=closed")} className={`rounded-full border px-3 py-1 text-sm ${closed ? "border-accent bg-accent/10" : "border-line text-muted"}`}>Closed</Link>
      </div>
      <ul className="divide-y divide-line/60 rounded-card border border-line bg-surface">
        {threads.map((t) => (
          <li key={t.id}>
            <Link href={adminHref(`support/${t.id}`)} className="flex items-center gap-4 px-5 py-4 hover:bg-surface-2/60">
              <span className={`size-2.5 shrink-0 rounded-full ${t.unread_by_admin ? "bg-accent" : "bg-transparent"}`} aria-label={t.unread_by_admin ? "Unread" : undefined} />
              <span className="min-w-0 flex-1">
                <span className={`block truncate ${t.unread_by_admin ? "font-semibold" : ""}`}>{t.subject}</span>
                <span className="block truncate text-sm text-muted">{t.name ? `${t.name} · ` : ""}{t.email}{t.user_id ? "" : " · contact form"}</span>
              </span>
              <span className="shrink-0 text-sm text-muted">{ago(t.last_message_at)}</span>
            </Link>
          </li>
        ))}
        {!threads.length && <li className="px-5 py-8 text-center text-muted">{closed ? "No closed conversations." : "Inbox zero. Nothing waiting."}</li>}
      </ul>
    </div>
  );
}
