import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ago, day, StatusBadge } from "@/components/admin/bits";
import { inputClass } from "@/components/ui";
import { customerDetail } from "@/lib/admin/data";
import { adminHref, requireAdmin } from "@/lib/admin/server";
import { MAX_DEVICES } from "@/lib/plans";
import { changeSubscription, confirmEmail, deleteCustomer, revokeDevice, saveNote, sendResetLink, setFreeAccess } from "./actions";
import { TempPassword } from "./TempPassword";

export const metadata: Metadata = { title: "Customer" };

const button = "rounded-full border border-line px-4 py-2 text-sm font-semibold hover:bg-surface-2";
const card = "rounded-card border border-line bg-surface p-5";

export default function CustomerPage({ params, searchParams }: PageProps<"/admin/customers/[id]">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <Customer params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Customer({ params, searchParams }: PageProps<"/admin/customers/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const { done } = await searchParams;
  const d = await customerDetail(id);
  if (!d) notFound();
  const c = d.row;
  const hidden = <input type="hidden" name="id" value={c.id} />;

  return (
    <div className="flex max-w-5xl flex-col gap-5">
      <Link href={adminHref("customers")} className="text-sm text-muted hover:text-fg">← Customers</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-bold tracking-tight break-all">{c.email}</h1>
        <StatusBadge status={c.status} />
      </div>
      <p className="-mt-3 text-sm text-muted">
        Joined {day(c.createdAt)} with {c.provider === "google" ? "Google" : "email"} · last sign-in {ago(c.lastSignInAt)}
        {!c.confirmed && " · email not confirmed"}
      </p>
      {typeof done === "string" && <p className="rounded-xl border border-ok/40 bg-ok/10 px-4 py-3 text-sm">{done}</p>}

      <div className="grid gap-5 lg:grid-cols-2">
        <section className={card}>
          <h2 className="font-semibold">Plan</h2>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-sm">
            <dt className="text-muted">Plan</dt>
            <dd>{c.status === "free" ? "Free access" : c.plan === "yearly" ? "Yearly" : c.plan === "monthly" ? "Monthly" : "Trial (no plan)"}</dd>
            <dt className="text-muted">{c.status === "cancelling" || c.status === "free" ? "Ends" : "Renews"}</dt>
            <dd>{c.status === "trial" || c.status === "unconfirmed" ? "—" : c.periodEnd ? day(c.periodEnd) : "No end date"}</dd>
            <dt className="text-muted">Computers</dt>
            <dd>{c.devices} signed in · {c.status === "free" ? c.comp.devices : MAX_DEVICES + c.extraDevices} allowed</dd>
            <dt className="text-muted">Stripe</dt>
            <dd>
              {c.stripeCustomerId ? (
                <a className="text-accent hover:underline" target="_blank" rel="noreferrer" href={`https://dashboard.stripe.com/${process.env.STRIPE_SECRET_KEY?.startsWith("sk_test") ? "test/" : ""}customers/${c.stripeCustomerId}`}>
                  Open in Stripe ↗
                </a>
              ) : "No payments yet"}
            </dd>
          </dl>
          {d.subscriptionId && (
            <div className="mt-4 flex flex-wrap gap-2">
              {c.status === "cancelling" ? (
                <SubButton id={c.id} sub={d.subscriptionId} how="resume" label="Undo cancellation" />
              ) : (
                <SubButton id={c.id} sub={d.subscriptionId} how="end" label="Cancel at period end" />
              )}
              <SubButton id={c.id} sub={d.subscriptionId} how="now" label="Cancel now" danger />
            </div>
          )}
        </section>

        <section className={card}>
          <h2 className="font-semibold">Free access</h2>
          <p className="mt-1 text-sm text-muted">Every feature without paying, like a paid plan. A paid plan always takes priority.</p>
          <form action={setFreeAccess} className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            {hidden}
            <label className="flex flex-col gap-1 text-muted">
              Until (empty = forever)
              <input type="date" name="until" defaultValue={c.comp.until?.slice(0, 10) ?? ""} className={inputClass} />
            </label>
            <label className="flex flex-col gap-1 text-muted">
              Booth computers
              <input type="number" name="devices" min={1} max={50} defaultValue={c.comp.devices} className={inputClass} />
            </label>
            <label className="flex flex-col gap-1 text-muted sm:col-span-2">
              Reason (only you see this)
              <input name="note" defaultValue={c.comp.note ?? ""} placeholder="e.g. my own booth business" className={inputClass} />
            </label>
            <div className="flex gap-2 sm:col-span-2">
              <button name="on" value="1" className="rounded-full bg-accent px-4 py-2 font-semibold text-accent-ink">{c.comp.active ? "Save free access" : "Give free access"}</button>
              {c.comp.active && <button name="on" value="0" className={button}>Turn off</button>}
            </div>
          </form>
        </section>

        <section className={card}>
          <h2 className="font-semibold">Sign-in help</h2>
          <div className="mt-3 flex flex-col items-start gap-3">
            <form action={sendResetLink}>
              {hidden}
              <button className={button}>Email a password reset link</button>
            </form>
            <TempPassword id={c.id} />
            {!c.confirmed && (
              <form action={confirmEmail}>
                {hidden}
                <button className={button}>Mark email as confirmed</button>
              </form>
            )}
          </div>
        </section>

        <section className={card}>
          <h2 className="font-semibold">Booth computers</h2>
          {d.devices.length ? (
            <ul className="mt-2 divide-y divide-line/60 text-sm">
              {d.devices.map((dev) => (
                <li key={dev.id} className="flex items-center justify-between gap-3 py-2">
                  <span>
                    {dev.name}
                    <span className="block text-xs text-muted">Last online {ago(dev.last_seen_at)}</span>
                  </span>
                  <form action={revokeDevice}>
                    {hidden}
                    <input type="hidden" name="device" value={dev.id} />
                    <button className="text-bad hover:underline">Sign out</button>
                  </form>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted">None signed in.</p>
          )}
          <p className="mt-3 text-sm text-muted">Cloud galleries: {d.galleries.events} events, {d.galleries.sessions} guest sessions.</p>
        </section>

        <section className={card}>
          <h2 className="font-semibold">Invoices</h2>
          {d.invoices.length ? (
            <table className="mt-2 w-full text-sm">
              <tbody>
                {d.invoices.map((i) => (
                  <tr key={i.id} className="border-t border-line/60">
                    <td className="py-1.5 text-muted">{day(i.date)}</td>
                    <td className="py-1.5">{(i.amount / 100).toFixed(2)} {i.currency.toUpperCase()}</td>
                    <td className="py-1.5 text-muted">{i.status}</td>
                    <td className="py-1.5 text-right">{i.url && <a href={i.url} target="_blank" rel="noreferrer" className="text-accent hover:underline">View ↗</a>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="mt-2 text-sm text-muted">No invoices.</p>
          )}
        </section>

        <section className={card}>
          <h2 className="font-semibold">Private notes</h2>
          <form action={saveNote} className="mt-3 flex flex-col gap-2">
            {hidden}
            <textarea name="note" rows={4} defaultValue={c.adminNote ?? ""} placeholder="Only you see this." className={inputClass} />
            <button className={`${button} self-start`}>Save note</button>
          </form>
        </section>
      </div>

      <section className={card}>
        <h2 className="font-semibold">History</h2>
        {d.audit.length ? (
          <ul className="mt-2 text-sm">
            {d.audit.map((a, i) => (
              <li key={i} className="flex gap-4 border-t border-line/60 py-1.5">
                <span className="w-40 shrink-0 text-muted">{new Date(a.at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</span>
                <span>{a.action}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted">No admin actions yet.</p>
        )}
      </section>

      <details className="rounded-card border border-bad/30 p-5">
        <summary className="cursor-pointer font-semibold text-bad">Delete this account</summary>
        <p className="mt-2 text-sm text-muted">Cancels their plan now, deletes their galleries, computers and login, and emails them. Can&apos;t be undone.</p>
        <form action={deleteCustomer} className="mt-3 flex flex-wrap items-end gap-3">
          {hidden}
          <label className="flex flex-col gap-1 text-sm text-muted">
            Type their email to confirm
            <input name="confirm" autoComplete="off" required className={inputClass} />
          </label>
          <button className="rounded-full border border-bad/60 px-5 py-2.5 font-semibold text-bad hover:bg-bad/10">Delete account</button>
        </form>
      </details>
    </div>
  );
}

function SubButton({ id, sub, how, label, danger }: { id: string; sub: string; how: "end" | "now" | "resume"; label: string; danger?: boolean }) {
  return (
    <form action={changeSubscription}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="subscription" value={sub} />
      <input type="hidden" name="how" value={how} />
      <button className={`rounded-full border px-4 py-2 text-sm font-semibold ${danger ? "border-bad/50 text-bad hover:bg-bad/10" : "border-line hover:bg-surface-2"}`}>{label}</button>
    </form>
  );
}
