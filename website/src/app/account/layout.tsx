import type { Metadata } from "next";
import { Suspense } from "react";
import { DashChrome } from "@/components/dash/DashChrome";
import { Logo } from "@/components/Logo";
import { NotReady } from "@/components/PageShell";
import { accountsEnabled, appUrl } from "@/lib/config";
import { dashboardUser, planLabel } from "@/lib/dashboard";

export const metadata: Metadata = {
  title: { default: "Dashboard", template: "%s · DSLR Snap" },
  robots: { index: false, follow: false },
};

/**
 * The operator's dashboard frame. It replaces the marketing site's header and footer: once signed
 * in, everything here is about running the business, not about DSLR Snap's own pages.
 */
export default function AccountLayout({ children }: LayoutProps<"/account">) {
  if (!accountsEnabled) {
    return (
      <main className="mx-auto max-w-md px-4 py-24">
        <Logo />
        <div className="mt-8"><NotReady /></div>
      </main>
    );
  }
  return (
    <Suspense fallback={<FrameSkeleton />}>
      <Frame>{children}</Frame>
    </Suspense>
  );
}

async function Frame({ children }: { children: React.ReactNode }) {
  const user = await dashboardUser();
  // Signed out: each page sends the visitor to sign in (and back to that page afterwards).
  if (!user) return children;
  return (
    <DashChrome
      user={{
        displayName: user.displayName,
        email: user.email,
        plan: planLabel(user),
        trial: !user.ent.active,
        unread: user.unread,
        homepageUrl: user.homepage?.enabled ? `${appUrl}/b/${user.homepage.slug}` : null,
      }}
    >
      {children}
    </DashChrome>
  );
}

function FrameSkeleton() {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[256px_minmax(0,1fr)]" aria-busy="true">
      <aside className="hidden border-r border-line bg-surface/50 p-5 lg:block">
        <Logo />
        <div className="mt-8 flex flex-col gap-2">
          {Array.from({ length: 6 }, (_, i) => <div key={i} className="h-9 animate-pulse rounded-xl bg-surface-2/60" />)}
        </div>
      </aside>
      <div>
        <div className="h-16 border-b border-line" />
        <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-10">
          <div className="h-8 w-56 animate-pulse rounded-lg bg-surface-2/60" />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => <div key={i} className="h-36 animate-pulse rounded-2xl bg-surface-2/40" />)}
          </div>
        </div>
      </div>
    </div>
  );
}
