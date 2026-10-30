import { CalendarDays, Check, CheckCircle2, CreditCard, FileText, LayoutGrid, Minus, Monitor, Plus, ReceiptText, RefreshCw, Settings2, Sparkles, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { eventDay } from "@/components/dash/EventCard";
import { btn, btnPrimary, EmptyState, IconChip, Meter, Notice, PageHeader, Pill, StatCard } from "@/components/dash/ui";
import { devicesFor } from "@/lib/account";
import { deviceLimit } from "@/lib/appAuth";
import { billingDetails } from "@/lib/billing";
import { stripeConfig } from "@/lib/config";
import { planLabel, requireDashboardUser } from "@/lib/dashboard";
import { EXTRA_COMPUTER, MAX_DEVICES, PLAN_INCLUDES, PLANS } from "@/lib/plans";
import { changeExtraComputers, openBillingPortal, startCheckout } from "../actions";

export const metadata: Metadata = { title: "Plan & billing" };

const TABS = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "plan", label: "Plan", icon: Sparkles },
  { id: "invoices", label: "Invoices", icon: ReceiptText },
] as const;

export default function BillingPage({ searchParams }: PageProps<"/account/billing">) {
  return (
    <Suspense>
      <Billing searchParams={searchParams} />
    </Suspense>
  );
}

async function Billing({ searchParams }: Pick<PageProps<"/account/billing">, "searchParams">) {
  const user = await requireDashboardUser("/account/billing");
  const sp = await searchParams;
  const ent = user.ent;
  const tab = TABS.find((t) => t.id === sp.tab)?.id ?? (ent.active ? "overview" : "plan");
  const [devices, billing] = await Promise.all([devicesFor(user.id), billingDetails(user.id)]);
  const limit = deviceLimit(ent);
  const paid = ent.active && !ent.complimentary;
  const canBuyExtra = paid && ent.plan && !!stripeConfig?.extraComputer[ent.plan];
  const chosen = sp.plan === "monthly" || sp.plan === "yearly" ? sp.plan : "yearly";
  const portal = (label: string, icon: typeof CreditCard, hint: string) => {
    const I = icon;
    return (
      <form action={openBillingPortal}>
        <button className="group flex w-full items-center gap-4 rounded-2xl border border-line bg-surface p-4 text-left transition-colors hover:border-accent/60 hover:bg-surface-2/40">
          <IconChip icon={I} tone="violet" />
          <span className="flex-1"><span className="block font-medium">{label}</span><span className="block text-sm text-muted">{hint}</span></span>
        </button>
      </form>
    );
  };

  return (
    <>
      <PageHeader title="Plan & billing" intro="Your DSLR Snap plan, booth computers, payment card and invoices." />

      {sp.checkout === "done" && <Notice>{ent.active ? "Thank you! Your plan is active." : "Payment received. Your plan shows here within a minute; refresh if it doesn't."}</Notice>}
      {sp.error === "billing" && <Notice tone="bad">Payments aren&apos;t switched on yet. Email us to subscribe.</Notice>}
      {sp.error === "computers" && <Notice tone="bad">Couldn&apos;t change your computers. Try again, or email us.</Notice>}
      {sp.error === "remove-computer-first" && <Notice tone="bad">All your computer slots are in use. Remove a computer first, then remove the extra slot.</Notice>}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard icon={Monitor} tone="accent" label="Booth computers" value={`${devices.length} of ${limit}`} href="/account/computers">
          <Meter value={devices.length} max={limit} tone={devices.length >= limit ? "amber" : "accent"} />
          {devices.length >= limit && <p className="mt-2 inline-flex items-center gap-1 self-start rounded-full bg-busy/15 px-2 py-0.5 text-xs text-busy"><TriangleAlert className="size-3" aria-hidden /> All slots in use</p>}
        </StatCard>
        <StatCard icon={Sparkles} tone="blue" label="Plan" value={planLabel(user)} sub={`${MAX_DEVICES} computers included${ent.active && ent.extraDevices ? ` + ${ent.extraDevices} extra` : ""}`} />
        <StatCard
          icon={CalendarDays}
          tone="green"
          label={ent.active ? (ent.cancelAtPeriodEnd ? "Ends on" : "Renews on") : "Trial"}
          value={ent.active ? (ent.periodEnd ? eventDay(ent.periodEnd, "short") : "No end date") : "Watermarked"}
          sub={ent.active ? (ent.cancelAtPeriodEnd ? "Auto-renew is off" : ent.complimentary ? "Free access from DSLR Snap" : "Auto-renew is on") : "Every feature works"}
        />
        <StatCard
          icon={CreditCard}
          tone="violet"
          label="Payment method"
          value={billing.card ? <span className="capitalize">{billing.card.brand} •••• {billing.card.last4}</span> : "None"}
          sub={billing.card ? `Expires ${billing.card.expires}` : "Added when you choose a plan"}
        />
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-surface">
        <nav className="flex overflow-x-auto border-b border-line" aria-label="Billing sections">
          {TABS.map(({ id, label, icon: I }) => (
            <Link
              key={id}
              href={`/account/billing?tab=${id}`}
              aria-current={tab === id ? "page" : undefined}
              className={`flex flex-1 items-center justify-center gap-2 border-b-2 px-5 py-3.5 text-sm whitespace-nowrap transition-colors ${tab === id ? "border-accent font-semibold text-fg" : "border-transparent text-muted hover:text-fg"}`}
            >
              <I className="size-4" aria-hidden /> {label}
            </Link>
          ))}
        </nav>

        <div className="p-5 sm:p-6">
          {tab === "overview" && (
            <div className="flex flex-col gap-6">
              {ent.active ? (
                <div className="flex flex-wrap items-start gap-4 rounded-2xl border border-ok/30 bg-ok/8 p-5">
                  <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-ok" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-lg font-semibold">{ent.complimentary ? "Free access is on" : "Subscription active"}</p>
                    <p className="mt-1 text-sm text-muted">
                      Your {planLabel(user).toLowerCase()} covers up to {limit} booth computers, with every feature and no watermark.
                    </p>
                    {ent.periodEnd && (
                      <p className="mt-2 flex items-center gap-1.5 text-sm text-muted">
                        {ent.cancelAtPeriodEnd ? <CalendarDays className="size-4" aria-hidden /> : <RefreshCw className="size-4" aria-hidden />}
                        {ent.cancelAtPeriodEnd ? "Ends" : "Renews"} on {eventDay(ent.periodEnd)}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-busy/30 bg-busy/8 p-5">
                  <Sparkles className="size-6 shrink-0 text-busy" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-lg font-semibold">You&apos;re on the free trial</p>
                    <p className="mt-1 text-sm text-muted">Everything works. Photos carry a small watermark until you choose a plan.</p>
                  </div>
                  <Link href="/account/billing?tab=plan" className={btnPrimary}>See plans</Link>
                </div>
              )}

              <div>
                <h3 className="mb-3 font-semibold">Quick actions</h3>
                <div className="grid gap-3 md:grid-cols-2">
                  <Link href="/account/computers" className="group flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-accent/60 hover:bg-surface-2/40">
                    <IconChip icon={Monitor} tone="green" />
                    <span className="flex-1"><span className="block font-medium">Manage booth computers</span><span className="block text-sm text-muted">{devices.length} of {limit} in use</span></span>
                  </Link>
                  {paid ? (
                    <>
                      {portal("Update payment method", CreditCard, "Change the card you pay with")}
                      {portal("Manage subscription", Settings2, "Switch monthly and yearly, or cancel")}
                      {portal("Download invoices", FileText, "Every receipt, ready for your accounts")}
                    </>
                  ) : (
                    <Link href="/account/billing?tab=plan" className="group flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-accent/60 hover:bg-surface-2/40">
                      <IconChip icon={Sparkles} />
                      <span className="flex-1"><span className="block font-medium">Choose a plan</span><span className="block text-sm text-muted">Remove the watermark</span></span>
                    </Link>
                  )}
                </div>
              </div>
            </div>
          )}

          {tab === "plan" && (
            <div className="flex flex-col gap-6">
              {ent.active ? (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <div>
                    <p className="text-sm text-muted">Current plan</p>
                    <p className="mt-1 font-display text-2xl font-bold">{planLabel(user)}</p>
                    <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
                      <div><dt className="text-muted">Computers</dt><dd className="mt-0.5 flex items-center gap-1.5 text-lg font-semibold"><Monitor className="size-4" aria-hidden /> {limit}</dd></div>
                      <div><dt className="text-muted">Billing</dt><dd className="mt-0.5 text-lg font-semibold">{ent.complimentary ? "Free" : ent.plan === "monthly" ? "Monthly" : "Yearly"}</dd></div>
                    </dl>
                    {paid && (
                      <form action={openBillingPortal} className="mt-5">
                        <button className={btn}><Settings2 className="size-4" /> Change or cancel plan</button>
                      </form>
                    )}
                  </div>
                  {canBuyExtra && (
                    <div className="rounded-2xl border border-line p-5">
                      <p className="font-semibold">Extra booth computers</p>
                      <p className="mt-1 text-sm text-muted">{MAX_DEVICES} are included. Each extra computer is {EXTRA_COMPUTER[ent.plan!]}.</p>
                      <div className="mt-4 flex items-center gap-3">
                        <form action={changeExtraComputers}>
                          <input type="hidden" name="delta" value="-1" />
                          <button disabled={!ent.extraDevices} className={`${btn} size-10 p-0`} aria-label="Remove an extra computer"><Minus className="size-4" /></button>
                        </form>
                        <span className="min-w-12 text-center font-display text-2xl font-bold">{ent.extraDevices}</span>
                        <form action={changeExtraComputers}>
                          <input type="hidden" name="delta" value="1" />
                          <button className={`${btn} size-10 p-0`} aria-label="Add an extra computer"><Plus className="size-4" /></button>
                        </form>
                        <span className="text-sm text-muted">extra</span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="grid gap-4 pt-2 md:grid-cols-2">
                    {PLANS.map((plan) => (
                      <form key={plan.id} action={startCheckout} className={`relative flex flex-col rounded-2xl border p-6 ${plan.id === chosen ? "border-accent bg-accent/5" : "border-line"}`}>
                        <input type="hidden" name="plan" value={plan.id} />
                        {plan.featured && <span className="absolute -top-3 left-6 rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-accent-ink">Best value</span>}
                        <p className="font-semibold">{plan.name}</p>
                        <p className="mt-2"><span className="font-display text-4xl font-bold">{plan.price}</span><span className="text-muted"> USD{plan.period}</span></p>
                        <p className="mt-1 text-sm text-muted">{plan.note}</p>
                        <button disabled={!stripeConfig} className={`${plan.id === chosen ? btnPrimary : btn} mt-5`}>Choose {plan.name.toLowerCase()}</button>
                      </form>
                    ))}
                  </div>
                  <ul className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                    {PLAN_INCLUDES.map((item) => (
                      <li key={item} className="flex items-center gap-2"><Check className="size-4 shrink-0 text-ok" aria-hidden /> {item}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}

          {tab === "invoices" &&
            (billing.invoices.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead className="text-muted">
                    <tr><th className="pb-3 font-medium">Date</th><th className="pb-3 font-medium">Amount</th><th className="pb-3 font-medium">Status</th><th className="pb-3" /></tr>
                  </thead>
                  <tbody>
                    {billing.invoices.map((i) => (
                      <tr key={i.id} className="border-t border-line">
                        <td className="py-3">{eventDay(i.date)}</td>
                        <td className="py-3 font-semibold">{i.amount}</td>
                        <td className="py-3"><Pill tone={i.status === "paid" ? "ok" : i.status === "open" ? "amber" : "muted"}><span className="capitalize">{i.status}</span></Pill></td>
                        <td className="py-3 text-right">{i.url && <a href={i.url} target="_blank" rel="noopener" className="font-semibold text-accent hover:underline">View</a>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState icon={ReceiptText} title="No invoices yet">Your receipts appear here after your first payment.</EmptyState>
            ))}
        </div>
      </div>
    </>
  );
}
