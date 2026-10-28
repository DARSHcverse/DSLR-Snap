import type { Metadata } from "next";
import Link from "next/link";
import { Card, PageShell } from "@/components/PageShell";

export const metadata: Metadata = { title: "Account deleted", robots: { index: false } };

export default function GoodbyePage() {
  return (
    <PageShell title="Your account is deleted" intro="Your login, booth computers and cloud galleries are gone, and nothing more will be charged.">
      <Card>
        <p className="text-muted">
          Thanks for trying DSLR Snap. The app keeps working on your computers as a free trial with a watermark, and you&apos;re welcome back any time.
        </p>
        <Link href="/" className="mt-4 inline-block font-semibold text-accent hover:underline">Back to the homepage</Link>
      </Card>
    </PageShell>
  );
}
