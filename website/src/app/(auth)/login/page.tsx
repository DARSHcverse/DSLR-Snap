import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { NotReady, PageShell } from "@/components/PageShell";
import { safeNext } from "@/lib/appAuth";
import { accountsEnabled } from "@/lib/config";
import { getCurrentUser } from "@/lib/supabase/server";
import { AuthForm } from "../AuthForm";

export const metadata: Metadata = { title: "Sign in · DSLR Snap", robots: { index: false } };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <PageShell title="Sign in" intro="Welcome back. Sign in to manage your plan and booth computers.">
      {accountsEnabled ? (
        <Suspense>
          <Login searchParams={searchParams} />
        </Suspense>
      ) : (
        <NotReady />
      )}
    </PageShell>
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
        next={next}
        notice={fromApp ? "Sign in to connect DSLR Snap on your booth computer." : sp.error ? "That link didn't work. Try signing in again." : undefined}
      />
      <p className="mt-6 flex justify-between text-sm text-muted">
        <a href={`/signup?next=${encodeURIComponent(next)}`} className="hover:text-fg">Create an account</a>
        <a href="/reset" className="hover:text-fg">Forgot password?</a>
      </p>
    </>
  );
}
