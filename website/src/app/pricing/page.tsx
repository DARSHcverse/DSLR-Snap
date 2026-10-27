import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage, JsonLd } from "@/components/ContentPage";
import { PricingCards } from "@/components/Pricing";
import { site, siteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Pricing",
  description: "DSLR Snap pricing: $14/month billed yearly or $30 monthly, every feature included, 2 booth computers, free trial with no time limit.",
  alternates: { canonical: "/pricing" },
};

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
        Switching from dslrBooth? <Link href="/compare/dslrbooth" className="text-accent hover:underline">See how the prices compare</Link>.
      </p>
    </ContentPage>
  );
}
