import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { ContentPage, Prose } from "@/components/ContentPage";
import { LAST_UPDATED, WhoWeAre } from "@/components/Legal";
import { MAX_DEVICES, OFFLINE_GRACE_DAYS } from "@/lib/plans";
import { site } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Terms of service",
  description:
    "The terms for using DSLR Snap: plans, payments and cancelling, the software licence, photos and guests' data, the camera makers' software, liability and ending the service.",
  path: "/terms",
});

export default function TermsPage() {
  const mail = <a href={`mailto:${site.supportEmail}`}>{site.supportEmail}</a>;
  return (
    <ContentPage title="Terms of service" intro={`Last updated ${LAST_UPDATED}.`} narrow>
      <Prose>
        <WhoWeAre />

        <h2>1. About these terms</h2>
        <ul>
          <li>These terms apply to the DSLR Snap desktop app, the website at dslrsnap.com and the cloud gallery (together, the &quot;service&quot;). By creating an account, starting a plan or using the app you agree to them. Please read them, along with our <a href="/privacy">privacy policy</a> and <a href="/refunds">refund policy</a>, which form part of them.</li>
          <li>DSLR Snap is made for photo booth businesses. If you use it for your business, you are a <strong>business customer</strong>. If you use it mainly for personal purposes, you are a <strong>consumer</strong>, and some sections below give you extra protection. Nothing in these terms affects a consumer&apos;s legal rights.</li>
          <li>We may update these terms, for example when the law or the service changes. We&apos;ll email you at least 30 days before a change that affects you materially. If you don&apos;t agree, you can cancel before it takes effect.</li>
        </ul>

        <h2>2. Your account</h2>
        <ul>
          <li>You must be 18 or over and give accurate details. Keep your password safe; you&apos;re responsible for what happens on your account, including on booth computers signed in to it.</li>
          <li>Tell us straight away at {mail} if you think someone else has used your account.</li>
        </ul>

        <h2>3. Free trial</h2>
        <p>You can use every feature free, with no time limit, with a small watermark on photos. The trial is provided as it is, so you can check the software works with your camera, printer and computer before paying.</p>

        <h2>4. Plans and payment</h2>
        <ul>
          <li>Plans are billed monthly or yearly in advance, in US dollars, through our payment provider Stripe. Prices are shown on the <a href="/pricing">pricing page</a> and at checkout, with any tax that applies.</li>
          <li>Your plan renews automatically at the end of each period until you cancel. We&apos;ll email you before a yearly plan renews.</li>
          <li>Each plan covers {MAX_DEVICES} booth computers. Extra computers can be added for a fee and are charged pro rata.</li>
          <li>If a payment fails we&apos;ll tell you and try again. If it still isn&apos;t paid after 14 days, we may move your account back to the trial until it is.</li>
          <li>We may change prices. We&apos;ll email you at least 30 days before, and a new price applies only from your next renewal, so you can cancel first.</li>
        </ul>

        <h2>5. Cancelling and refunds</h2>
        <ul>
          <li>Cancel any time under Plan &amp; billing in your account. You keep access until the end of the period you&apos;ve paid for, and you won&apos;t be charged again.</li>
          <li>Our <a href="/refunds">refund policy</a> explains when we refund, including a full refund within 14 days of a first yearly payment.</li>
          <li><strong>Consumers&apos; right to cancel:</strong> if you&apos;re a consumer in the UK or EU, you can cancel a new plan within 14 days of buying it. Because the service starts straight away when you ask for it, if you cancel within those 14 days we&apos;ll refund what you paid minus a fair amount for the days you had the service. Email {mail} or use the cancel button in your account.</li>
        </ul>

        <h2>6. Your licence to use DSLR Snap</h2>
        <ul>
          <li>While your account is in good standing, we give you a non-exclusive, non-transferable licence to install and use the app on your booth computers, within your plan&apos;s computer limit, for running photo booths for yourself and your clients.</li>
          <li>The app checks your licence when it&apos;s online and keeps working offline for up to {OFFLINE_GRACE_DAYS} days. Without an active plan it runs as the trial.</li>
          <li>We own DSLR Snap, its design, code and brand (or license them from others). Apart from this licence, these terms don&apos;t give you any rights in them.</li>
          <li>We release updates to fix problems and improve the service. Updates install between events, never during one. Keep the app reasonably up to date; very old versions may stop being supported.</li>
        </ul>

        <h2>7. Acceptable use</h2>
        <p>You must not:</p>
        <ul>
          <li>copy, sell, share, sub-license or rent the app or your licence, or use it to get around the computer limit;</li>
          <li>reverse engineer, decompile, crack or tamper with the app or its licence checks, except where the law allows it;</li>
          <li>use the service to break the law, to harass anyone, or to store or share content that is unlawful, infringes someone&apos;s rights, or that you don&apos;t have permission to use (for example backgrounds, overlays, fonts and music);</li>
          <li>try to access other customers&apos; data, overload the service, or probe it for weaknesses without our written permission.</li>
        </ul>

        <h2>8. Your photos and your guests</h2>
        <ul>
          <li>Photos, videos and designs you create belong to you (or your client, as you agree with them). You give us permission to store, process and deliver them only to provide the service to you.</li>
          <li>For guests at your events you are the <strong>controller</strong> of their personal data and we are your <strong>processor</strong>. You are responsible for having a lawful basis to take, share and keep their photos, and for telling them how they&apos;re used, for example with a sign at the booth.</li>
          <li>Cloud gallery photos and videos are kept for one year after they&apos;re taken, then deleted automatically. Everything is also saved in the event folder on your booth computer; keep your own backups.</li>
        </ul>

        <h2>9. How we process your guests&apos; data</h2>
        <p>When we process personal data for you (mainly guests&apos; photos and videos in the cloud gallery), these terms are our data processing agreement under Article 28 of the UK GDPR and EU GDPR. We will:</p>
        <ul>
          <li>process it only to provide the service and on your instructions (which are how you set up and use the service), unless the law requires otherwise;</li>
          <li>make sure anyone who handles it is bound by confidentiality;</li>
          <li>keep it secure, with private storage, encrypted connections, links that expire and access limited to what&apos;s needed;</li>
          <li>use only the sub-processors listed in our <a href="/privacy">privacy policy</a>, under written terms giving the same protection, and tell you before adding new ones so you can object;</li>
          <li>help you answer requests from guests exercising their rights, and with security and data protection assessments, where reasonable;</li>
          <li>tell you without undue delay after we become aware of a personal data breach affecting your data;</li>
          <li>delete it when it reaches the end of its retention period, when you delete it, or when your account is closed;</li>
          <li>give you the information you reasonably need to show these obligations are met.</li>
        </ul>
        <p>Data may be processed outside the UK by our sub-processors, protected by the UK International Data Transfer Addendum, the EU standard contractual clauses or the UK-US data bridge.</p>

        <h2>10. Camera makers&apos; software</h2>
        <ul>
          <li>The app includes software from Canon and Nikon so it can control their cameras. You may use it only as part of DSLR Snap, and you may not copy it, reverse engineer it or use it on its own.</li>
          <li>That software is provided by its makers &quot;as is&quot;, without any warranty from them, and they aren&apos;t liable to you for any loss arising from its use.</li>
          <li>Nikon Corporation is a third-party beneficiary of this section and may enforce it directly.</li>
        </ul>

        <h2>11. Other services</h2>
        <p>Payments are processed by Stripe and sign-in with Google is provided by Google, under their own terms. We&apos;re not responsible for services we don&apos;t control, but we choose them carefully.</p>

        <h2>12. Availability and support</h2>
        <ul>
          <li>We work hard to keep DSLR Snap reliable, and the booth is designed to keep working offline, but we can&apos;t promise the service will always be available or error-free. Always test your setup before an event.</li>
          <li>We may change or improve features. We won&apos;t remove a major feature you pay for without at least 30 days&apos; notice; if a change materially affects you, you can cancel and we&apos;ll refund any unused prepaid period.</li>
          <li>Support is by chat in your dashboard and by email. We usually reply within one working day.</li>
        </ul>

        <h2>13. Our responsibility to you</h2>
        <h3>If you&apos;re a business customer</h3>
        <ul>
          <li>We aren&apos;t liable for loss of profits, revenue, bookings, business, goodwill or data, or for any indirect or consequential loss.</li>
          <li>Our total liability in each 12-month period is limited to the fees you paid us in the 12 months before the event giving rise to the claim.</li>
          <li>Apart from what these terms say, the service is provided without any other warranty or condition, to the extent the law allows.</li>
        </ul>
        <h3>If you&apos;re a consumer</h3>
        <ul>
          <li>We&apos;re responsible for loss or damage you suffer that is a foreseeable result of our breaking these terms or failing to use reasonable care and skill. We&apos;re not responsible for loss that wasn&apos;t foreseeable, or for business losses.</li>
          <li>If software we supply damages a device or other digital content belonging to you because we didn&apos;t use reasonable care and skill, we&apos;ll repair the damage or pay you compensation.</li>
        </ul>
        <h3>For everyone</h3>
        <p>Nothing in these terms limits liability for death or personal injury caused by negligence, for fraud, or for anything else that can&apos;t be limited by law.</p>

        <h2>14. Your responsibility to us</h2>
        <p>If you&apos;re a business customer, you&apos;ll cover our reasonable losses and costs from a claim brought against us by a third party (for example a guest or a rights holder) because of content you used or shared through the service, or because you broke data protection law or section 7 or 8 of these terms.</p>

        <h2>15. Suspending or ending the service</h2>
        <ul>
          <li>You can stop using DSLR Snap and delete your account at any time in Settings. Deleting it removes your galleries straight away.</li>
          <li>We may suspend or close an account that seriously or repeatedly breaks these terms, or that isn&apos;t paid. Unless the breach is serious or the law requires otherwise, we&apos;ll warn you first and give you time to put it right.</li>
          <li>If we ever close the service, we&apos;ll give at least 60 days&apos; notice so you can download your galleries, and refund any unused prepaid period.</li>
        </ul>

        <h2>16. Events outside our control</h2>
        <p>We aren&apos;t responsible for delays or failures caused by events outside our reasonable control, such as outages at our providers, internet failures, power cuts or natural disasters. We&apos;ll tell you and do what we reasonably can to limit the effect.</p>

        <h2>17. General</h2>
        <ul>
          <li>We may transfer our rights and obligations under these terms to another organisation, for example if the business is sold or incorporated, and we&apos;ll tell you. Your rights as a customer won&apos;t be reduced. You may transfer yours only with our written agreement.</li>
          <li>If a court finds part of these terms unenforceable, the rest stays in force. If we don&apos;t enforce a right straight away, we can still enforce it later.</li>
          <li>These terms, the privacy policy and the refund policy are the whole agreement between us about the service. Apart from Nikon under section 10, no one else has rights under them.</li>
        </ul>

        <h2>18. Law and disputes</h2>
        <p>
          These terms are governed by the law of {site.business.jurisdiction}, and its courts have jurisdiction. If you&apos;re a consumer living in Scotland or Northern Ireland you can also bring proceedings in your local courts, and if you live in the EU you keep the protection of your country&apos;s mandatory consumer law. If you have a complaint, please contact us first at {mail} so we can try to put it right.
        </p>
      </Prose>
    </ContentPage>
  );
}
