import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/AuthShell";
import { NotReady } from "@/components/PageShell";
import { accountsEnabled } from "@/lib/config";
import { ResetForm } from "./ResetForm";

export const metadata: Metadata = { title: "Reset password", robots: { index: false } };

export default function ResetPage({ searchParams }: PageProps<"/reset">) {
  return (
    <AuthShell title="Reset your password" intro="We'll email you a link to choose a new one.">
      {accountsEnabled ? (
        <Suspense>
          <Reset searchParams={searchParams} />
        </Suspense>
      ) : (
        <NotReady />
      )}
    </AuthShell>
  );
}

async function Reset({ searchParams }: Pick<PageProps<"/reset">, "searchParams">) {
  const sp = await searchParams;
  return <ResetForm step={sp.step === "new" ? "new" : "request"} />;
}
