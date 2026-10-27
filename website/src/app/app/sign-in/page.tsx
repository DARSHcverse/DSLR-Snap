import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Card, NotReady, PageShell } from "@/components/PageShell";
import { entitlementFor } from "@/lib/account";
import { cleanDeviceName, isChallenge, isState } from "@/lib/appAuth";
import { appSignInEnabled } from "@/lib/config";
import { getCurrentUser } from "@/lib/supabase/server";
import { ApproveSignIn } from "./ApproveSignIn";

export const metadata: Metadata = { title: "Open DSLR Snap", robots: { index: false } };

/** The page the app opens in the browser. Once approved, it hands a one-time code back to the app. */
export default function AppSignInPage({ searchParams }: PageProps<"/app/sign-in">) {
  return (
    <PageShell title="Sign in to DSLR Snap">
      {appSignInEnabled ? (
        <Suspense>
          <Approve searchParams={searchParams} />
        </Suspense>
      ) : (
        <NotReady />
      )}
    </PageShell>
  );
}

async function Approve({ searchParams }: Pick<PageProps<"/app/sign-in">, "searchParams">) {
  const sp = await searchParams;
  const { challenge, state, name } = sp;
  if (!isChallenge(challenge) || !isState(state)) {
    return (
      <Card>
        <p>This link is incomplete. In DSLR Snap, open Account and press Sign in again.</p>
      </Card>
    );
  }
  const user = await getCurrentUser();
  if (!user) {
    const back = `/app/sign-in?${new URLSearchParams({ challenge, state, name: cleanDeviceName(name) })}`;
    redirect(`/login?next=${encodeURIComponent(back)}`);
  }
  const ent = await entitlementFor(user.id);
  return (
    <Card>
      <p className="text-muted">Signed in as {user.email}</p>
      <p className="mt-2 text-lg">
        Connect <span className="font-semibold">{cleanDeviceName(name)}</span> to your account?
      </p>
      {!ent.active && (
        <p className="mt-2 text-sm text-muted">
          You don&apos;t have a plan yet, so the booth stays in trial mode until you <a href="/account" className="text-accent">choose one</a>.
        </p>
      )}
      <ApproveSignIn challenge={challenge} state={state} />
    </Card>
  );
}
