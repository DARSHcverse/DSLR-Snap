import type { Metadata } from "next";
import { Suspense } from "react";
import { inputClass } from "@/components/ui";
import { requireAdmin } from "@/lib/admin/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { sendAnnouncement } from "./actions";

export const metadata: Metadata = { title: "Emails" };

export default function EmailsPage({ searchParams }: PageProps<"/admin/emails">) {
  return (
    <>
      <h1 className="font-display text-3xl font-bold tracking-tight">Emails</h1>
      <Suspense fallback={<p className="mt-6 text-muted">Loading…</p>}>
        <Emails searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Emails({ searchParams }: Pick<PageProps<"/admin/emails">, "searchParams">) {
  await requireAdmin();
  const { done } = await searchParams;
  const { data: log } = await supabaseAdmin().from("email_log").select("key, to_email, template, sent_at").order("sent_at", { ascending: false }).limit(40);
  return (
    <div className="mt-6 flex max-w-4xl flex-col gap-6">
      {typeof done === "string" && <p className="rounded-xl border border-ok/40 bg-ok/10 px-4 py-3 text-sm">{done}</p>}
      <section className="rounded-card border border-line bg-surface p-5">
        <h2 className="font-semibold">Announce a new version</h2>
        <p className="mt-1 text-sm text-muted">
          Emails every confirmed customer who hasn&apos;t unsubscribed, with a button to download it. Booths update by themselves too. Send a test to support@ first.
        </p>
        <form action={sendAnnouncement} className="mt-4 flex flex-col gap-3">
          <label className="flex max-w-40 flex-col gap-1 text-sm text-muted">
            Version
            <input name="version" placeholder="1.2.0" required className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted">
            What&apos;s new (one per line)
            <textarea name="highlights" rows={4} required placeholder={"Nikon Z cameras are out of beta\nFaster green screen on Surface Pro"} className={inputClass} />
          </label>
          <div className="flex flex-wrap gap-2">
            <button name="mode" value="test" className="rounded-full border border-line px-4 py-2 text-sm font-semibold hover:bg-surface-2">Send test to support@</button>
            <button
              name="mode"
              value="all"
              className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-ink"
            >
              Send to all customers
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-card border border-line bg-surface p-5">
        <h2 className="font-semibold">Recently sent</h2>
        <p className="mt-1 text-sm text-muted">Emails tied to an event (sign-up, payment, update). Resend&apos;s dashboard has every email with delivery status.</p>
        <table className="mt-3 w-full text-sm">
          <tbody>
            {(log ?? []).map((l) => (
              <tr key={l.key} className="border-t border-line/60">
                <td className="py-1.5 pr-4 text-muted whitespace-nowrap">{new Date(l.sent_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</td>
                <td className="py-1.5 pr-4">{l.template}</td>
                <td className="py-1.5 break-all text-muted">{l.to_email}</td>
              </tr>
            ))}
            {!log?.length && <tr><td className="py-3 text-muted">Nothing yet.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}
