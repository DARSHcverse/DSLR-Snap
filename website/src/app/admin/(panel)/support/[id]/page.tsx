import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LiveRefresh } from "@/components/chat/LiveRefresh";
import { Messages } from "@/components/chat/Messages";
import { ReplyBox } from "@/components/chat/ReplyBox";
import { adminHref, requireAdmin } from "@/lib/admin/server";
import { threadForAdmin } from "@/lib/support";
import { changeStatus, replyAsAdmin } from "../actions";

export const metadata: Metadata = { title: "Conversation" };

export default function ConversationPage({ params }: PageProps<"/admin/support/[id]">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <Conversation params={params} />
    </Suspense>
  );
}

async function Conversation({ params }: Pick<PageProps<"/admin/support/[id]">, "params">) {
  await requireAdmin();
  const { id } = await params;
  const d = await threadForAdmin(id);
  if (!d) notFound();
  const t = d.thread;
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <LiveRefresh />
      <Link href={adminHref("support")} className="text-sm text-muted hover:text-fg">← Support</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">{t.subject}</h1>
          <p className="mt-1 text-sm text-muted">
            {t.name ? `${t.name} · ` : ""}
            {t.user_id ? <Link href={adminHref(`customers/${t.user_id}`)} className="text-accent hover:underline">{t.email}</Link> : `${t.email} · contact form (your reply is emailed)`}
          </p>
        </div>
        <form action={changeStatus}>
          <input type="hidden" name="thread" value={t.id} />
          <input type="hidden" name="status" value={t.status === "open" ? "closed" : "open"} />
          <button className="rounded-full border border-line px-4 py-2 text-sm font-semibold hover:bg-surface-2">{t.status === "open" ? "Close conversation" : "Reopen"}</button>
        </form>
      </div>
      <div className="rounded-card border border-line bg-surface p-5">
        <div className="max-h-[60vh] overflow-y-auto pr-1">
          <Messages messages={d.messages} mine="admin" otherName={t.name ?? t.email} />
        </div>
        <div className="mt-5 border-t border-line pt-4">
          <ReplyBox action={replyAsAdmin} hidden={{ thread: t.id }} placeholder={`Reply to ${t.name ?? t.email}…`} />
        </div>
      </div>
    </div>
  );
}
