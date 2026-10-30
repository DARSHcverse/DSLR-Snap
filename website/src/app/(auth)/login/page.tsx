import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthShell } from "@/components/AuthShell";
import { NotReady } from "@/components/PageShell";
import { safeNext } from "@/lib/appAuth";
import { accountsEnabled, googleSignInEnabled } from "@/lib/config";
import { getCurrentUser } from "@/lib/supabase/server";
import { AuthForm } from "../AuthForm";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <AuthShell title="Welcome back" intro="Sign in to your DSLR Snap dashboard.">
      {accountsEnabled ? (
        <Suspense>
          <Login searchParams={searchParams} />
        </Suspense>
      ) : (
        <NotReady />
      )}
    </AuthShell>
  );
}

async function Login({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  if (await getCurrentUser()) redirect(next);
  const fromApp = next.startsWith("/app/sign-in");
  return (
    <>
      <AuthForm
        mode="login"
        google={await googleSignInEnabled()}
        next={next}
        notice={fromApp ? "Sign in to connect DSLR Snap on your booth computer." : sp.error ? "That link didn't work. Try signing in again." : undefined}
      />
      <p className="mt-6 text-sm text-muted">
        Don&apos;t have an account yet?{" "}
        <a href={`/signup?next=${encodeURIComponent(next)}`} className="font-semibold text-accent hover:underline">Start free</a>
      </p>
    </>
  );
}
