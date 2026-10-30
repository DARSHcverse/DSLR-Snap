import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { ContentPage, Prose } from "@/components/ContentPage";
import { LAST_UPDATED, WhoWeAre } from "@/components/Legal";
import { site } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Privacy policy",
  description:
    "What DSLR Snap stores about photo booth operators and their guests, why, where it's kept, for how long, who we share it with and how to use your rights.",
  path: "/privacy",
});

const PROVIDERS = [
  ["Supabase", "Accounts, database and gallery storage"],
  ["Cloudflare", "Gallery photo storage (R2) and email forwarding"],
  ["Vercel", "Website hosting and cookie-free visit statistics"],
  ["Stripe", "Payments, invoices and fraud prevention"],
  ["Resend", "Sending and receiving email"],
  ["Google", "Sign in with Google, if you choose it"],
];

export default function PrivacyPage() {
  const mail = <a href={`mailto:${site.supportEmail}`}>{site.supportEmail}</a>;
  return (
    <ContentPage title="Privacy policy" intro={`Last updated ${LAST_UPDATED}.`} narrow>
      <Prose>
        <WhoWeAre />
        <p>This policy explains what personal data we collect when you use dslrsnap.com, the DSLR Snap app and the cloud gallery, why we use it, and your rights under UK and EU data protection law. For our customers&apos; data we are the <strong>controller</strong>. For guests&apos; photos at our customers&apos; events, the photo booth operator is the controller and we process the photos for them (see &quot;Guests at events&quot;).</p>

        <h2>Photo booth operators (our customers)</h2>
        <ul>
          <li><strong>Account:</strong> your email address, password (stored only as a secure hash) or your Google sign-in, business name and homepage details if you add them.</li>
          <li><strong>Billing:</strong> handled by Stripe. We receive your plan, payment status, billing country and the last four digits of your card, never your full card number.</li>
          <li><strong>Booth computers:</strong> each computer&apos;s name and a one-way fingerprint of its ID, to apply your plan&apos;s computer limit. The raw ID never leaves the computer.</li>
          <li><strong>Support:</strong> what you send us by chat, the contact form or email.</li>
          <li><strong>Emails:</strong> whether you want product update emails.</li>
        </ul>
        <p>We use this to provide the service you signed up for (contract), to keep records the law requires such as invoices (legal obligation), and to prevent fraud and licence abuse and to improve the service (our legitimate interests). We send update emails only if you leave them switched on, and you can turn them off in Settings or from any such email.</p>

        <h2>Guests at events</h2>
        <p>When an operator switches on QR downloads, the booth uploads each guest&apos;s photos and videos to the cloud gallery so the guest, and the event host, can view and download them. The operator decides this and is the controller; we process the photos only to store and deliver them, under the data processing terms in our <a href="/terms">terms of service</a>.</p>
        <ul>
          <li>Each session has a private, unguessable link. Files are stored privately and shown only through links that expire after an hour. Galleries aren&apos;t listed publicly or indexed by search engines, unless the operator chooses to show an event on their homepage.</li>
          <li>Photos and videos are deleted automatically one year after they were taken, or sooner if the operator deletes them.</li>
          <li>Photos taken with QR downloads off never leave the booth computer.</li>
          <li>To show operators how often a gallery is viewed, we count visits without cookies. A visitor is counted using a one-way code made from the connection and browser details that changes every day, so it can&apos;t identify anyone.</li>
        </ul>
        <p>If you&apos;re a guest and want a photo removed, please ask the photo booth company that ran the event. You can also contact us and we&apos;ll pass your request on.</p>

        <h2>Website visitors</h2>
        <p>We use Vercel Web Analytics and Speed Insights, which count visits without cookies and without identifying you. Signing in uses a strictly necessary cookie to keep you logged in, and a gallery password sets a cookie so you don&apos;t have to type it again. We don&apos;t use advertising or tracking cookies, so we don&apos;t need a cookie banner. To protect forms from abuse we briefly keep a one-way code made from your connection&apos;s address.</p>

        <h2>Who we share data with</h2>
        <p>We never sell personal data. We share it only with the providers that run the service, each under a data processing agreement:</p>
        <ul>
          {PROVIDERS.map(([name, use]) => <li key={name}><strong>{name}:</strong> {use}</li>)}
        </ul>
        <p>Some of these providers are based in, or use servers in, the United States. Those transfers are protected by the UK International Data Transfer Addendum, the EU standard contractual clauses or the UK-US data bridge. We may also share data if the law requires it, or to protect our rights or someone&apos;s safety.</p>

        <h2>How long we keep it</h2>
        <ul>
          <li>Account, booth computers and settings: until you delete your account.</li>
          <li>Gallery photos and videos: one year, or until deleted by the operator or with the account.</li>
          <li>Invoices and payment records: 6 years after the end of the tax year they relate to, as UK tax law requires (kept by Stripe).</li>
          <li>Support conversations: for as long as they&apos;re useful to help you, and deleted on request.</li>
        </ul>

        <h2>Keeping it safe</h2>
        <p>Data is encrypted in transit, stored with providers that encrypt it at rest, and accessible only to the people and systems that need it. Payment details stay with Stripe.</p>

        <h2>Your rights</h2>
        <p>You have the right to ask for a copy of your data, to correct it, to delete it, to restrict or object to how we use it, and to receive it in a portable format. Where we rely on your consent, you can withdraw it at any time. You can delete your account yourself under Settings: that removes your login, booth computers and every gallery photo and video straight away. For anything else, email {mail} and we&apos;ll reply within one month.</p>
        <p>If you&apos;re unhappy with how we&apos;ve handled your data, please tell us first. You can also complain to the Information Commissioner&apos;s Office at <a href="https://ico.org.uk/make-a-complaint/">ico.org.uk</a>, or to the data protection authority where you live in the EU.</p>

        <h2>Children</h2>
        <p>Accounts are for adults running a business. Guests of any age may appear in event photos; the operator is responsible for having permission, for example from a parent.</p>

        <h2>Changes</h2>
        <p>We&apos;ll update this page if anything changes, with a new date at the top, and email customers about important changes.</p>
      </Prose>
    </ContentPage>
  );
}
