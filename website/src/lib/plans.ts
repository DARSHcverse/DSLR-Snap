// Placeholder prices until launch. The amounts customers pay come from the Stripe prices
// (STRIPE_PRICE_MONTHLY / STRIPE_PRICE_YEARLY); keep these labels in step with them.
export type PlanId = "monthly" | "yearly";

export const PLANS: {
  id: PlanId;
  name: string;
  price: string;
  period: string;
  note: string;
  featured: boolean;
}[] = [
  { id: "monthly", name: "Monthly", price: "$30", period: "/month", note: "Cancel any time", featured: false },
  {
    id: "yearly",
    name: "Yearly",
    price: "$14",
    period: "/month",
    note: "Billed $168 yearly · save 53%",
    featured: true,
  },
];

export const PLAN_INCLUDES = [
  "Every feature, no watermark",
  "Use on 2 booth computers",
  "Cloud gallery and QR downloads",
  "Unlimited events, prints and guests",
  "Works offline at events",
  "All updates included",
];

/** Booth computers included with a plan (and allowed during the trial). Enforced by claim_device(). */
export const MAX_DEVICES = 2;

/** Extra booth computers on top of the included 2, billed as a quantity on the subscription. */
export const EXTRA_COMPUTER = { yearly: "$50/year", monthly: "$5/month" } as const;

/** How long a booth keeps working without reaching the website. */
export const OFFLINE_GRACE_DAYS = 14;
