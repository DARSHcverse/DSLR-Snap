import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, PageShell } from "@/components/PageShell";
import { primaryButton, secondaryButton } from "@/components/ui";
import { changeUpdates } from "./actions";

export const metadata: Metadata = { title: "Email preferences", robots: { index: false, follow: false } };

/** Linked from update emails. A button, not the link itself, unsubscribes: mail scanners open links. */
export default function UnsubscribePage({ searchParams }: PageProps<"/email/unsubscribe">) {
  return (
    <PageShell title="Email preferences">
      <Suspense>
        <Preferences searchParams={searchParams} />
      </Suspense>
    </PageShell>
  );
}

async function Preferences({ searchParams }: Pick<PageProps<"/email/unsubscribe">, "searchParams">) {
  const { t, done } = await searchParams;
  const token = typeof t === "string" ? t : "";
  if (done === "invalid" || !token) {
    return <Card><p>This link isn&apos;t valid any more. Change your email settings on your account page instead.</p></Card>;
  }
  const off = done === "off";
  return (
    <Card>
      <p className="font-semibold">{off ? "You're unsubscribed from update emails." : done === "on" ? "Update emails are back on." : "Stop emails about new versions and features?"}</p>
      <p className="mt-2 text-muted">
        You&apos;ll still get emails about your account, payments and security, and replies to your support messages.
      </p>
      <form action={changeUpdates} className="mt-5">
        <input type="hidden" name="t" value={token} />
        <input type="hidden" name="on" value={off ? "1" : "0"} />
        <button className={off ? secondaryButton : primaryButton}>{off ? "Resubscribe" : "Unsubscribe"}</button>
      </form>
    </Card>
  );
}
