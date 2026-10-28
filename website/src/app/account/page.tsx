import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Icon } from "@/components/Icon";
import { Card, NotReady, PageShell } from "@/components/PageShell";
import { primaryButton, secondaryButton } from "@/components/ui";
import { DELETE_CONFIRMATION, devicesFor, entitlementFor } from "@/lib/account";
import { deviceLimit } from "@/lib/appAuth";
import { accountsEnabled, stripeConfig } from "@/lib/config";
import { EXTRA_COMPUTER, MAX_DEVICES, OFFLINE_GRACE_DAYS, PLAN_INCLUDES, PLANS } from "@/lib/plans";
import { getCurrentUser } from "@/lib/supabase/server";
import { signOut } from "../(auth)/actions";
import { changeExtraComputers, deleteMyAccount, openBillingPortal, removeDevice, setUpdateEmails, startCheckout } from "./actions";
import { updatesOn } from "@/lib/email/preferences";

export const metadata: Metadata = { title: "Your account", robots: { index: false } };

const date = (ms: number | string) => new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

export default function AccountPage({ searchParams }: PageProps<"/account">) {
  return (
    <PageShell title="Your account" wide>
      {accountsEnabled ? (
        <Suspense fallback={<p className="text-muted">Loading your account…</p>}>
          <Account searchParams={searchParams} />
        </Suspense>
      ) : (
        <NotReady />
      )}
    </PageShell>
  );
}

async function Account({ searchParams }: Pick<PageProps<"/account">, "searchParams">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account");
  const sp = await searchParams;
  const [ent, devices, updates] = await Promise.all([entitlementFor(user.id), devicesFor(user.id), updatesOn(user.id)]);
  const chosen = sp.plan === "monthly" || sp.plan === "yearly" ? sp.plan : "yearly";
  const limit = deviceLimit(ent);
  const canBuyExtra = ent.active && ent.plan && !!stripeConfig?.extraComputer[ent.plan];

  return (
    <div className="flex flex-col gap-6">
      <p className="text-muted">Signed in as {user.email}</p>

      {sp.checkout === "done" && !ent.active && (
        <p className="rounded-xl border border-ok/40 bg-ok/10 px-4 py-3">Payment received. Your plan shows here within a minute; refresh if it doesn&apos;t.</p>
      )}
      {sp.error === "billing" && <p className="rounded-xl border border-bad/40 bg-bad/10 px-4 py-3">Payments aren&apos;t switched on yet. Email us to subscribe.</p>}
      {sp.error === "computers" && <p className="rounded-xl border border-bad/40 bg-bad/10 px-4 py-3">Couldn&apos;t change your computers. Try again, or email us.</p>}
      {sp.error === "remove-computer-first" && (
        <p className="rounded-xl border border-bad/40 bg-bad/10 px-4 py-3">All your computer slots are in use. Remove a computer below first, then remove the extra slot.</p>
      )}

      <Card>
        <h2 className="text-lg font-semibold">Plan</h2>
        {ent.active ? (
          <>
            <p className="mt-2">
              <span className="font-semibold">{ent.plan === "monthly" ? "Monthly" : "Yearly"} plan</span>
              <span className="text-muted">
                {" · "}
                {ent.cancelAtPeriodEnd ? "ends" : "renews"} on {date(ent.periodEnd!)}
              </span>
            </p>
            <form action={openBillingPortal} className="mt-5">
              <button className={secondaryButton}>Manage billing, invoices or cancel</button>
            </form>
          </>
        ) : (
          <>
            <p className="mt-2 text-muted">You&apos;re on the free trial: everything works, and photos carry a small watermark.</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {PLANS.map((plan) => (
                <form key={plan.id} action={startCheckout} className={`rounded-xl border p-5 ${plan.id === chosen ? "border-accent bg-surface-2" : "border-line"}`}>
                  <input type="hidden" name="plan" value={plan.id} />
                  <p className="font-semibold">{plan.name}</p>
                  <p className="mt-1">
                    <span className="font-display text-3xl font-bold">{plan.price}</span>
                    <span className="text-muted"> USD{plan.period}</span>
                  </p>
                  <p className="mt-1 text-sm text-muted">{plan.note}</p>
                  <button disabled={!stripeConfig} className={`${primaryButton} mt-4`}>Choose {plan.name.toLowerCase()}</button>
                </form>
              ))}
            </div>
            <ul className="mt-5 grid gap-2 text-sm sm:grid-cols-2">
              {PLAN_INCLUDES.map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <Icon name="check" className="size-4 shrink-0 text-ok" />
                  {item}
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">
          Booth computers <span className="text-muted">({devices.length} of {limit})</span>
        </h2>
        {devices.length ? (
          <ul className="mt-3 divide-y divide-line">
            {devices.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-4 py-3">
                <div>
                  <p className="font-medium">{d.name}</p>
                  <p className="text-sm text-muted">Last online {d.last_seen_at ? date(d.last_seen_at) : "never"}</p>
                </div>
                <form action={removeDevice}>
                  <input type="hidden" name="id" value={d.id} />
                  <button className="text-sm text-bad hover:underline">Remove</button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-muted">None yet. Open DSLR Snap on your booth computer and press Sign in under Account.</p>
        )}
        {canBuyExtra && (
          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4">
            <p className="mr-auto text-sm text-muted">
              {MAX_DEVICES} included{ent.extraDevices ? ` + ${ent.extraDevices} extra` : ""} · extra computers {EXTRA_COMPUTER[ent.plan!]} each
            </p>
            {ent.extraDevices > 0 && (
              <form action={changeExtraComputers}>
                <input type="hidden" name="delta" value="-1" />
                <button className="text-sm text-muted hover:text-fg">Remove an extra computer</button>
              </form>
            )}
            <form action={changeExtraComputers}>
              <input type="hidden" name="delta" value="1" />
              <button className={secondaryButton}>Add a computer</button>
            </form>
          </div>
        )}
        <p className="mt-4 text-sm text-muted">
          Each booth checks in when it&apos;s online and keeps working offline for {OFFLINE_GRACE_DAYS} days. Removing a computer frees its slot.
        </p>
      </Card>

      <Card>
        <h2 id="emails" className="text-lg font-semibold">Emails</h2>
        <p className="mt-2 text-muted">
          {updates ? "We'll email you when a new version of DSLR Snap is out." : "You won't get emails about new versions."} Emails about your account,
          payments and security always arrive.
        </p>
        <form action={setUpdateEmails} className="mt-4">
          <input type="hidden" name="on" value={updates ? "0" : "1"} />
          <button className={secondaryButton}>{updates ? "Stop update emails" : "Email me about updates"}</button>
        </form>
      </Card>

      <form action={signOut}>
        <button className="text-sm text-muted hover:text-fg">Sign out of the website</button>
      </form>

      <details id="delete" className="rounded-card border border-bad/30 p-6" open={sp.error === "confirm-delete" || sp.error === "delete"}>
        <summary className="cursor-pointer font-semibold text-bad">Delete your account</summary>
        <div className="mt-3 flex flex-col gap-3 text-sm text-muted">
          <p>This can&apos;t be undone. Straight away:</p>
          <ul className="list-disc pl-5">
            {ent.active && <li>Your plan ends now, with no refund for the time left. To stop renewing but keep using it until {ent.periodEnd ? date(ent.periodEnd) : "the end of the period"}, cancel under Manage billing instead.</li>}
            <li>Every booth computer is signed out and drops to the free trial.</li>
            <li>Every cloud gallery, QR link and host page stops working, and their photos and videos are deleted.</li>
          </ul>
          <p>Photos on your booth computers aren&apos;t touched. Stripe keeps your invoices, as the law requires.</p>
          {sp.error === "confirm-delete" && <p className="text-bad">Type {DELETE_CONFIRMATION} in capitals to confirm.</p>}
          {sp.error === "delete" && <p className="text-bad">Something went wrong and nothing was deleted. Try again, or email us.</p>}
          <form action={deleteMyAccount} className="flex flex-wrap items-center gap-3">
            <label className="flex flex-col gap-1">
              <span>Type {DELETE_CONFIRMATION} to confirm</span>
              <input name="confirm" autoComplete="off" required className="rounded-xl border border-line bg-bg px-3 py-2 text-fg" />
            </label>
            <button className="self-end rounded-full border border-bad/60 px-5 py-2.5 font-semibold text-bad hover:bg-bad/10">Delete my account</button>
          </form>
        </div>
      </details>
    </div>
  );
}
