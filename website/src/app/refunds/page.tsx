import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { ContentPage, Prose } from "@/components/ContentPage";
import { LAST_UPDATED } from "@/components/Legal";
import { site } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Refund policy",
  description:
    "DSLR Snap's refund policy: try it free first, a 14-day refund on your first yearly payment, monthly plans, extra booth computers and how to cancel.",
  path: "/refunds",
});

export default function RefundsPage() {
  const mail = <a href={`mailto:${site.supportEmail}`}>{site.supportEmail}</a>;
  return (
    <ContentPage title="Refund policy" intro={`Last updated ${LAST_UPDATED}.`} narrow>
      <Prose>
        <p>Try DSLR Snap free first: the trial has every feature and no time limit, with a watermark on photos. That way you can test it with your own camera, printer and computer before you pay.</p>

        <h2>Yearly plans</h2>
        <ul>
          <li>Not right for you? Ask within <strong>14 days of your first yearly payment</strong> and we&apos;ll refund it in full, no questions asked.</li>
          <li>Forgot to cancel before a renewal? Ask within 7 days of the renewal and, if you haven&apos;t used the booth since, we&apos;ll refund it in full.</li>
        </ul>

        <h2>Monthly plans</h2>
        <p>Cancel any time and you won&apos;t be charged again; you keep access until the end of the month you&apos;ve paid for. We don&apos;t refund part-months, except as described for consumers below.</p>

        <h2>Extra booth computers</h2>
        <p>Add or remove them under Plan &amp; billing. Stripe adjusts the charge automatically for the time left in your billing period.</p>

        <h2>If you&apos;re a consumer</h2>
        <p>If you bought DSLR Snap mainly for personal use and live in the UK or EU, you also have a legal right to cancel within 14 days of buying a plan. As the service starts straight away, we&apos;ll refund what you paid minus a fair amount for the days you used it. This is in addition to the yearly refund above.</p>

        <h2>If something goes wrong</h2>
        <p>If DSLR Snap doesn&apos;t work as described and we can&apos;t fix it, tell us and we&apos;ll refund the part of your plan you couldn&apos;t use.</p>

        <h2>How to ask</h2>
        <p>Chat with us in your dashboard, or email {mail} from your account email. Refunds go back to the card you paid with, usually within 5–10 working days. This policy doesn&apos;t affect your legal rights.</p>
      </Prose>
    </ContentPage>
  );
}
