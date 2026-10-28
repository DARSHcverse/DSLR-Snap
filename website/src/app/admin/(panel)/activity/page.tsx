import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { adminHref, requireAdmin } from "@/lib/admin/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Activity" };

/** Every admin action and sign-in, newest first. */
export default function ActivityPage() {
  return (
    <>
      <h1 className="font-display text-3xl font-bold tracking-tight">Activity</h1>
      <Suspense fallback={<p className="mt-6 text-muted">Loading…</p>}>
        <Activity />
      </Suspense>
    </>
  );
}

async function Activity() {
  await requireAdmin();
  const db = supabaseAdmin();
  const [{ data: log }, { data: logins }] = await Promise.all([
    db.from("admin_audit").select("id, at, action, user_id, user_email, detail, ip").order("at", { ascending: false }).limit(200),
    db.from("admin_login_attempts").select("at, ip, ok").eq("ok", false).order("at", { ascending: false }).limit(20),
  ]);
  return (
    <div className="mt-6 flex max-w-5xl flex-col gap-6">
      <div className="overflow-x-auto rounded-card border border-line bg-surface">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-muted">
            <tr className="border-b border-line"><th className="px-4 py-3 font-medium">When</th><th className="px-4 py-3 font-medium">Action</th><th className="px-4 py-3 font-medium">Customer</th><th className="px-4 py-3 font-medium">From</th></tr>
          </thead>
          <tbody>
            {(log ?? []).map((a) => (
              <tr key={a.id} className="border-t border-line/60">
                <td className="px-4 py-2 whitespace-nowrap text-muted">{new Date(a.at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</td>
                <td className="px-4 py-2">{a.action}</td>
                <td className="px-4 py-2">{a.user_id ? <Link className="hover:text-accent" href={adminHref(`customers/${a.user_id}`)}>{a.user_email}</Link> : <span className="text-muted">—</span>}</td>
                <td className="px-4 py-2 text-muted">{a.ip}</td>
              </tr>
            ))}
            {!log?.length && <tr><td colSpan={4} className="px-4 py-6 text-center text-muted">Nothing yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <section className="rounded-card border border-line bg-surface p-5">
        <h2 className="font-semibold">Failed admin sign-ins</h2>
        <p className="mt-1 text-sm text-muted">5 failures from one address (or 30 in total) within 15 minutes locks sign-in for 15 minutes.</p>
        <ul className="mt-2 text-sm">
          {(logins ?? []).map((l, i) => (
            <li key={i} className="border-t border-line/60 py-1.5 text-muted">{new Date(l.at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })} · {l.ip}</li>
          ))}
          {!logins?.length && <li className="text-muted">None.</li>}
        </ul>
      </section>
    </div>
  );
}
