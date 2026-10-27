import type { Metadata } from "next";
import { Suspense } from "react";
import { NotReady, PageShell } from "@/components/PageShell";
import { accountsEnabled } from "@/lib/config";
import { ResetForm } from "./ResetForm";

export const metadata: Metadata = { title: "Reset password · DSLR Snap", robots: { index: false } };

export default function ResetPage({ searchParams }: PageProps<"/reset">) {
  return (
    <PageShell title="Reset your password">
      {accountsEnabled ? (
        <Suspense>
          <Reset searchParams={searchParams} />
        </Suspense>
      ) : (
        <NotReady />
      )}
    </PageShell>
  );
}

async function Reset({ searchParams }: Pick<PageProps<"/reset">, "searchParams">) {
  const sp = await searchParams;
  return <ResetForm step={sp.step === "new" ? "new" : "request"} />;
}
