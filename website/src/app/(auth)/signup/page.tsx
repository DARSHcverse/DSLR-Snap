import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { NotReady, PageShell } from "@/components/PageShell";
import { safeNext } from "@/lib/appAuth";
import { accountsEnabled } from "@/lib/config";
import { getCurrentUser } from "@/lib/supabase/server";
import { AuthForm } from "../AuthForm";

export const metadata: Metadata = { title: "Create your account", description: "Start DSLR Snap free: every feature works, with a small watermark until you choose a plan.", alternates: { canonical: "/signup" } };

export default function SignupPage({ searchParams }: PageProps<"/signup">) {
  return (
    <PageShell
      title="Create your account"
      intro="Try DSLR Snap free: everything works, with a small watermark on photos until you choose a plan."
    >
      {accountsEnabled ? (
        <Suspense>
          <Signup searchParams={searchParams} />
        </Suspense>
      ) : (
        <NotReady />
      )}
    </PageShell>
  );
}

async function Signup({ searchParams }: Pick<PageProps<"/signup">, "searchParams">) {
  const sp = await searchParams;
  // A plan chosen on the pricing section carries through to the account page's checkout.
  const plan = sp.plan === "monthly" || sp.plan === "yearly" ? sp.plan : undefined;
  const next = safeNext(sp.next, plan ? `/account?plan=${plan}` : "/account");
  if (await getCurrentUser()) redirect(next);
  return (
    <>
      <AuthForm mode="signup" next={next} />
      <p className="mt-6 text-sm text-muted">
        Already have an account?{" "}
        <a href={`/login?next=${encodeURIComponent(next)}`} className="text-fg underline-offset-4 hover:underline">Sign in</a>
      </p>
    </>
  );
}
