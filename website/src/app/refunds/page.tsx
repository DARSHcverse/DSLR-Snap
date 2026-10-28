import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { ContentPage, Prose } from "@/components/ContentPage";
import { LAST_UPDATED } from "@/components/Legal";
import { site } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Refund policy",
  description:
    "DSLR Snap's refund policy: monthly and yearly plans, extra booth computers and how to cancel.",
  path: "/refunds",
});

export default function RefundsPage() {
  return (
    <ContentPage title="Refund policy" intro={`Last updated ${LAST_UPDATED}.`} narrow>
      <Prose>
        <p>Try DSLR Snap free first: the trial has every feature and no time limit, with a watermark on photos. That way you can test it with your own camera and printer before paying.</p>
        <h2>Yearly plans</h2>
        <p>If DSLR Snap isn&apos;t right for you, ask for a refund within 14 days of your first yearly payment and we&apos;ll refund it in full. Renewals can be refunded within 7 days if you haven&apos;t used the booth since renewing.</p>
        <h2>Monthly plans</h2>
        <p>Cancel any time and you won&apos;t be charged again; you keep access until the end of the month you paid for. Partial months aren&apos;t refunded.</p>
        <h2>Extra computers</h2>
        <p>Added and removed in your account; changes are prorated automatically by Stripe.</p>
        <h2>How to ask</h2>
        <p>Email <a href={`mailto:${site.supportEmail}`}>{site.supportEmail}</a> from your account email. Refunds go back to the original card within 5–10 working days. This doesn&apos;t affect your statutory rights.</p>
      </Prose>
    </ContentPage>
  );
}
