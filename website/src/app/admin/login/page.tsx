import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Logo } from "@/components/Logo";
import { adminConfig, hasPendingLogin } from "@/lib/admin/server";
import { restartLogin } from "./actions";
import { CodeForm, PasswordForm } from "./LoginForm";

export const metadata: Metadata = { title: "Office", robots: { index: false, follow: false }, alternates: { canonical: null } };

export default function AdminLoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <Logo />
        <div className="mt-8 rounded-card border border-line bg-surface p-6">
          <Suspense>
            <Step />
          </Suspense>
        </div>
      </div>
    </main>
  );
}

async function Step() {
  if (!adminConfig) notFound();
  if (await hasPendingLogin()) {
    return (
      <>
        <h1 className="mb-5 text-xl font-semibold">Enter your code</h1>
        <CodeForm />
        <form action={restartLogin} className="mt-4">
          <button className="text-sm text-muted hover:text-fg">Start again</button>
        </form>
      </>
    );
  }
  return (
    <>
      <h1 className="mb-5 text-xl font-semibold">Sign in</h1>
      <PasswordForm />
    </>
  );
}
