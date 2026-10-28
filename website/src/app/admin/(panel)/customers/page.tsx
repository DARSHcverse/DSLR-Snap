import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ago, day, STATUS, StatusBadge } from "@/components/admin/bits";
import { inputClass } from "@/components/ui";
import { type CustomerStatus, listCustomers } from "@/lib/admin/data";
import { adminHref, requireAdmin } from "@/lib/admin/server";

export const metadata: Metadata = { title: "Customers" };

const FILTERS: (CustomerStatus | "all")[] = ["all", "paying", "cancelling", "past_due", "free", "trial", "unconfirmed"];

export default function CustomersPage({ searchParams }: PageProps<"/admin/customers">) {
  return (
    <>
      <h1 className="font-display text-3xl font-bold tracking-tight">Customers</h1>
      <Suspense fallback={<p className="mt-6 text-muted">Loading customers…</p>}>
        <Customers searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Customers({ searchParams }: Pick<PageProps<"/admin/customers">, "searchParams">) {
  await requireAdmin();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().toLowerCase() : "";
  const status = FILTERS.includes(sp.status as CustomerStatus) ? (sp.status as CustomerStatus | "all") : "all";
  const all = await listCustomers();
  const shown = all.filter((c) => (status === "all" || c.status === status) && (!q || c.email.toLowerCase().includes(q)));
  const count = (f: CustomerStatus | "all") => (f === "all" ? all.length : all.filter((c) => c.status === f).length);
  const link = (f: CustomerStatus | "all") => adminHref(`customers?${new URLSearchParams({ ...(q ? { q } : {}), ...(f !== "all" ? { status: f } : {}) })}`);

  return (
    <div className="mt-6 flex flex-col gap-4">
      <form action={adminHref("customers")} className="flex max-w-xl gap-2">
        {status !== "all" && <input type="hidden" name="status" value={status} />}
        <input name="q" defaultValue={q} placeholder="Search by email" className={inputClass} />
        <button className="rounded-xl border border-line px-4 text-sm font-semibold hover:bg-surface-2">Search</button>
      </form>
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link key={f} href={link(f)} className={`rounded-full border px-3 py-1 text-sm ${f === status ? "border-accent bg-accent/10 text-fg" : "border-line text-muted hover:text-fg"}`}>
            {f === "all" ? "All" : STATUS[f].label} <span className="text-muted">{count(f)}</span>
          </Link>
        ))}
      </div>

      <div className="overflow-x-auto rounded-card border border-line bg-surface">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="text-muted">
            <tr className="border-b border-line">
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Plan</th>
              <th className="px-4 py-3 font-medium">Renews / ends</th>
              <th className="px-4 py-3 font-medium">Computers</th>
              <th className="px-4 py-3 font-medium">Joined</th>
              <th className="px-4 py-3 font-medium">Last sign-in</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((c) => (
              <tr key={c.id} className="border-t border-line/60 hover:bg-surface-2/60">
                <td className="max-w-[280px] truncate px-4 py-3">
                  <Link href={adminHref(`customers/${c.id}`)} className="font-medium hover:text-accent">{c.email}</Link>
                  {c.provider === "google" && <span className="ml-2 text-xs text-muted">Google</span>}
                </td>
                <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                <td className="px-4 py-3 text-muted">{c.status === "free" ? "Free" : c.plan === "yearly" ? "Yearly" : c.plan === "monthly" ? "Monthly" : "—"}</td>
                <td className="px-4 py-3 text-muted">{c.status === "trial" || c.status === "unconfirmed" ? "—" : c.periodEnd ? day(c.periodEnd) : "No end date"}</td>
                <td className="px-4 py-3 text-muted">{c.devices}</td>
                <td className="px-4 py-3 text-muted">{day(c.createdAt)}</td>
                <td className="px-4 py-3 text-muted">{ago(c.lastSignInAt)}</td>
              </tr>
            ))}
            {!shown.length && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted">No customers match.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
