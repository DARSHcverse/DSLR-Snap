import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LiveRefresh } from "@/components/chat/LiveRefresh";
import { Messages } from "@/components/chat/Messages";
import { ReplyBox } from "@/components/chat/ReplyBox";
import { Card, NotReady, PageShell } from "@/components/PageShell";
import { accountsEnabled } from "@/lib/config";
import { threadForUser, threadsForUser } from "@/lib/support";
import { getCurrentUser } from "@/lib/supabase/server";
import { sendReply } from "./actions";
import { NewConversation } from "./NewConversation";

export const metadata: Metadata = { title: "Chat with support", robots: { index: false } };

export default function SupportChatPage({ searchParams }: PageProps<"/account/support">) {
  return (
    <PageShell title="Chat with us" intro="Ask anything about setting up, your booth or your plan. We usually reply within one working day, and we email you when we do." wide>
      {accountsEnabled ? (
        <Suspense fallback={<p className="text-muted">Loading…</p>}>
          <Chat searchParams={searchParams} />
        </Suspense>
      ) : (
        <NotReady />
      )}
    </PageShell>
  );
}

async function Chat({ searchParams }: Pick<PageProps<"/account/support">, "searchParams">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account/support");
  const { t } = await searchParams;
  const threads = await threadsForUser(user.id);
  const open = typeof t === "string" ? await threadForUser(user.id, t) : null;

  return (
    <div className="flex flex-col gap-5">
      {threads.length > 0 && (
        <nav className="flex flex-wrap gap-2">
          {threads.map((th) => (
            <Link
              key={th.id}
              href={`/account/support?t=${th.id}`}
              className={`rounded-full border px-3 py-1.5 text-sm ${open?.thread.id === th.id ? "border-accent bg-accent/10" : "border-line text-muted hover:text-fg"}`}
            >
              {th.unread_by_customer && <span className="mr-1.5 inline-block size-2 rounded-full bg-accent" aria-label="New reply" />}
              {th.subject}
            </Link>
          ))}
          <Link href="/account/support" className={`rounded-full border px-3 py-1.5 text-sm ${open ? "border-line text-muted hover:text-fg" : "border-accent bg-accent/10"}`}>+ New</Link>
        </nav>
      )}

      {open ? (
        <Card>
          <LiveRefresh />
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">{open.thread.subject}</h2>
            {open.thread.status === "closed" && <span className="text-xs text-muted">Closed · reply to reopen</span>}
          </div>
          <div className="mt-4 max-h-[60vh] overflow-y-auto pr-1">
            <Messages messages={open.messages} mine="customer" otherName="DSLR Snap support" />
          </div>
          <div className="mt-5 border-t border-line pt-4">
            <ReplyBox action={sendReply} hidden={{ thread: open.thread.id }} placeholder="Write a reply…" />
          </div>
        </Card>
      ) : (
        <Card>
          <h2 className="mb-4 font-semibold">New conversation</h2>
          <NewConversation />
        </Card>
      )}
      <p className="text-sm text-muted">
        Quick answers to common questions are on the <Link href="/support" className="text-accent hover:underline">help page</Link>.
      </p>
    </div>
  );
}
