import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { ContentPage, Prose } from "@/components/ContentPage";
import { LAST_UPDATED, WhoWeAre } from "@/components/Legal";
import { site } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Privacy policy",
  description:
    "What DSLR Snap stores about operators and guests, where it's kept, for how long, and how to get a copy or delete your account.",
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <ContentPage title="Privacy policy" intro={`Last updated ${LAST_UPDATED}.`} narrow>
      <Prose>
        <WhoWeAre />
        <p>This policy explains what we collect when you use dslrsnap.com, the DSLR Snap app and the cloud gallery, why, and your rights under UK and EU data protection law.</p>

        <h2>Operators (our customers)</h2>
        <ul>
          <li><strong>Account:</strong> your email address and a password (or your Google sign-in). Used to run your account. Stored with Supabase.</li>
          <li><strong>Billing:</strong> handled by Stripe. We receive your plan, status and billing country, never your full card number.</li>
          <li><strong>Booth computers:</strong> a name you can see (e.g. the computer&apos;s name) and a one-way fingerprint of the computer&apos;s ID, to enforce the computer limit. The raw ID never leaves your computer.</li>
          <li><strong>Support:</strong> what you send us through the contact form or email.</li>
        </ul>
        <p>Legal basis: performing our contract with you, and our legitimate interest in preventing licence abuse.</p>

        <h2>Guests at your events</h2>
        <p>
          When you switch on QR downloads, the booth uploads each guest&apos;s photos and videos to our cloud gallery so the guest can download them.
          You (the operator) decide this and are the controller; we process the photos on your behalf, only to store and deliver them.
        </p>
        <ul>
          <li>Each session gets a private, unguessable link. Files are stored privately and shown only through links that expire after an hour. Galleries aren&apos;t listed or indexed by search engines.</li>
          <li>Photos and videos are deleted automatically after one year.</li>
          <li>Photos taken with QR downloads off never leave your computer.</li>
        </ul>

        <h2>Website visitors</h2>
        <p>We use Vercel Web Analytics and Speed Insights, which count visits without cookies and without identifying you. Signing in uses a necessary cookie to keep you logged in. We don&apos;t use advertising cookies.</p>

        <h2>Who we share data with</h2>
        <p>Only the providers that run the service: Supabase (accounts, database and gallery storage), Stripe (payments), Vercel (website hosting and analytics) and Resend (sending email). Each processes data under a data processing agreement. Some are based in the US; transfers are covered by standard contractual clauses or the UK-US data bridge.</p>

        <h2>Your rights</h2>
        <p>You can delete your account yourself at any time under Your account: that deletes your login, booth computers and every gallery photo and video straight away (Stripe keeps payment records for as long as the law requires). You can also ask for a copy of your data, to correct or delete it, or object to how we use it, by emailing <a href={`mailto:${site.supportEmail}`}>{site.supportEmail}</a>. Guests asking about their photos can contact the booth operator, or us and we&apos;ll pass it on. You can also complain to the Information Commissioner&apos;s Office (ico.org.uk).</p>

        <h2>Changes</h2>
        <p>We&apos;ll update this page if anything changes and email customers about important changes.</p>
      </Prose>
    </ContentPage>
  );
}
