import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import Link from "next/link";
import { ContentPage, JsonLd } from "@/components/ContentPage";
import { Faq } from "@/components/Faq";
import { PricingCards } from "@/components/Pricing";
import { EXTRA_COMPUTER, OFFLINE_GRACE_DAYS } from "@/lib/plans";
import { site, siteUrl } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Photo Booth Software Pricing: from $14/month",
  description:
    "DSLR Snap pricing: $14/month billed yearly or $30 monthly. Every feature, 2 booth computers, no per-print fees, and a free trial with no time limit.",
  path: "/pricing",
});

const PRICING_FAQ = [
  { q: "Is there a free trial?", a: "Yes, with no time limit. Every feature works in the trial, and photos carry a small watermark until you choose a plan. No card is needed to try it." },
  { q: "What's the difference between monthly and yearly?", a: "Nothing but the price. Both include every feature and 2 booth computers. Yearly is $168 a year ($14 a month), 53% less than paying $30 monthly." },
  { q: "Are there per-print or per-event fees?", a: "No. Events, prints, guests, QR downloads and the cloud gallery are all unlimited and included in the plan." },
  { q: "Can I use more than 2 booth computers?", a: `Yes. Add extra computers from your account for ${EXTRA_COMPUTER.yearly} each on a yearly plan, or ${EXTRA_COMPUTER.monthly} each on a monthly plan.` },
  { q: "What if my subscription ends during an event?", a: `The booth keeps working. DSLR Snap checks your licence when it's online and keeps working offline for ${OFFLINE_GRACE_DAYS} days, so an event is never interrupted.` },
  { q: "Can I cancel or get a refund?", a: "Cancel any time from your account; your plan runs to the end of the period you paid for. If the yearly plan isn't right for you, ask within 14 days of your first yearly payment for a full refund." },
];

export default function PricingPage() {
  return (
    <ContentPage eyebrow="Pricing" title="One plan, everything included" intro="No feature tiers, no per-print fees, no add-ons for the phone remote or the cloud gallery. Pay monthly, or save 53% yearly.">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Product",
          name: site.name,
          description: site.description,
          url: `${siteUrl}/pricing`,
          offers: [
            { "@type": "Offer", name: "Monthly", price: "30", priceCurrency: "USD" },
            { "@type": "Offer", name: "Yearly", price: "168", priceCurrency: "USD" },
          ],
        }}
      />
      <PricingCards />
      <p className="mt-10 text-center text-muted">
        Switching from dslrBooth (LumaBooth for Windows)? <Link href="/compare/dslrbooth" className="text-accent hover:underline">See how the prices compare</Link>.
      </p>
      <div className="mx-auto max-w-3xl">
        <Faq title="Pricing questions" items={PRICING_FAQ} />
      </div>
    </ContentPage>
  );
}
