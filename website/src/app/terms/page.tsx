import type { Metadata } from "next";
import { ContentPage, Prose } from "@/components/ContentPage";
import { LAST_UPDATED, WhoWeAre } from "@/components/Legal";
import { MAX_DEVICES, OFFLINE_GRACE_DAYS } from "@/lib/plans";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Terms of service", alternates: { canonical: "/terms" } };

export default function TermsPage() {
  return (
    <ContentPage title="Terms of service" intro={`Last updated ${LAST_UPDATED}.`} narrow>
      <Prose>
        <WhoWeAre />
        <p>These terms apply to the DSLR Snap desktop app, the website and the cloud gallery. By creating an account or using the app you agree to them.</p>

        <h2>Your account</h2>
        <ul>
          <li>You must be 18 or older and give accurate details. Keep your password safe; you&apos;re responsible for activity on your account.</li>
          <li>DSLR Snap is a business tool for photo booth operators. If you use it as a consumer, your statutory rights are not affected.</li>
        </ul>

        <h2>Subscriptions and licences</h2>
        <ul>
          <li>Plans are billed monthly or yearly in advance through Stripe and renew automatically until cancelled. Cancel any time in your account; you keep access to the end of the paid period.</li>
          <li>Each plan covers {MAX_DEVICES} booth computers; extra computers are added for a fee. Licences may not be shared, resold or used to get around the computer limit.</li>
          <li>The app checks your licence when online and keeps working offline for up to {OFFLINE_GRACE_DAYS} days. Without an active plan it runs in trial mode with a watermark.</li>
          <li>We may change prices with at least 30 days&apos; notice by email; changes apply from your next renewal.</li>
          <li>Refunds: see the <a href="/refunds">refund policy</a>.</li>
        </ul>

        <h2>Acceptable use</h2>
        <ul>
          <li>Don&apos;t reverse engineer, crack or tamper with the app or its licence checks, or use the service to break the law.</li>
          <li>Only upload content you have the right to use (for example backgrounds, overlays and music) and that doesn&apos;t infringe anyone&apos;s rights.</li>
        </ul>

        <h2>Photos, videos and your guests</h2>
        <ul>
          <li>Photos and videos you take belong to you (or your client, as you agree with them). You give us permission only to store and deliver them to provide the service.</li>
          <li>You are responsible for telling guests how their photos are used and for having a lawful basis to take and share them, as the controller of that personal data; we process it on your behalf as described in our <a href="/privacy">privacy policy</a>.</li>
          <li>Gallery photos and videos are kept for one year, then deleted. Keep your own copies: the app saves everything in the event folder on your computer.</li>
        </ul>

        <h2>Camera makers&apos; software</h2>
        <ul>
          <li>The app includes software from Canon and Nikon so it can control their cameras. You may use it only as part of DSLR Snap, and you may not copy it, reverse engineer it or use it on its own.</li>
          <li>That software is provided by its makers &quot;as is&quot;, without any warranty from them, and they aren&apos;t liable for any loss arising from its use.</li>
          <li>Nikon Corporation is a third-party beneficiary of this section and may enforce it directly.</li>
        </ul>

        <h2>Availability and liability</h2>
        <ul>
          <li>We work hard to keep DSLR Snap reliable, and it&apos;s designed to keep working offline, but we can&apos;t promise it will be uninterrupted or error-free. Always test your setup before an event.</li>
          <li>To the extent the law allows, we&apos;re not liable for indirect or consequential loss (such as lost bookings or profits), and our total liability is limited to the fees you paid in the 12 months before the claim. Nothing limits liability that can&apos;t be limited by law.</li>
        </ul>

        <h2>Ending the service</h2>
        <p>You can stop using DSLR Snap and delete your account at any time by contacting us. We may suspend accounts that break these terms or don&apos;t pay. If we ever close the service, we&apos;ll give at least 60 days&apos; notice so you can download your galleries.</p>

        <h2>Law</h2>
        <p>These terms are governed by the law of {site.business.jurisdiction}, whose courts have jurisdiction. Questions: <a href={`mailto:${site.supportEmail}`}>{site.supportEmail}</a>.</p>
      </Prose>
    </ContentPage>
  );
}
