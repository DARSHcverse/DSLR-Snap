import { accountsEnabled } from "@/lib/config";
import { EXTRA_COMPUTER, PLAN_INCLUDES, PLANS } from "@/lib/plans";
import { earlyAccessHref } from "@/lib/site";
import { Icon } from "./Icon";

/** The two plan cards, shared by the homepage and /pricing. */
export function PricingCards() {
  return (
    <>
      <div className="mx-auto mt-14 grid max-w-3xl gap-4 sm:grid-cols-2">
        {PLANS.map((plan) => (
          <div key={plan.name} className={`relative flex flex-col rounded-card border p-7 ${plan.featured ? "border-accent bg-surface-2" : "border-line bg-surface"}`}>
            {plan.featured && (
              <span className="absolute -top-3 left-7 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-ink">Best value</span>
            )}
            <h3 className="text-lg font-semibold">{plan.name}</h3>
            <p className="mt-4 flex items-baseline gap-1">
              <span className="font-display text-5xl font-bold tracking-[-0.02em]">{plan.price}</span>
              <span className="text-muted">USD{plan.period}</span>
            </p>
            <p className="mt-2 text-sm text-muted">{plan.note}</p>
            <ul className="mt-6 mb-8 flex-1 space-y-2.5">
              {PLAN_INCLUDES.map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <Icon name="check" className="mt-0.5 size-5 shrink-0 text-ok" />
                  {item}
                </li>
              ))}
            </ul>
            <a
              href={accountsEnabled ? `/signup?plan=${plan.id}` : earlyAccessHref}
              className={`rounded-full px-6 py-3 text-center font-semibold transition-transform active:scale-[0.97] ${plan.featured ? "bg-accent text-accent-ink" : "border border-line hover:bg-surface-2"}`}
            >
              {accountsEnabled ? "Start free trial" : "Get early access"}
            </a>
          </div>
        ))}
      </div>
      <p className="mt-6 text-center text-sm text-muted">
        Extra booth computers {EXTRA_COMPUTER.yearly} each. Prices in US dollars; local taxes may apply at checkout.
        The free trial has no time limit: photos carry a small watermark until you choose a plan.
      </p>
    </>
  );
}
