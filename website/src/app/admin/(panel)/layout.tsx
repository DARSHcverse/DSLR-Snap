import type { Metadata } from "next";
import { Suspense } from "react";
import { Logo } from "@/components/Logo";
import { adminHref, requireAdmin } from "@/lib/admin/server";
import { unreadCount } from "@/lib/support";
import { logout } from "../login/actions";
import { AdminNav } from "./AdminNav";

export const metadata: Metadata = {
  title: { default: "Office", template: "%s · Office" },
  robots: { index: false, follow: false },
  alternates: { canonical: null },
};

/** The admin frame. Every page inside is checked here and again in each page and action. */
export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="p-10 text-muted">Loading…</div>}>
      <Panel>{children}</Panel>
    </Suspense>
  );
}

async function Panel({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  const unread = await unreadCount();
  const links = [
    { href: adminHref(), label: "Dashboard" },
    { href: adminHref("customers"), label: "Customers" },
    { href: adminHref("support"), label: "Support", badge: unread },
    { href: adminHref("emails"), label: "Emails" },
    { href: adminHref("activity"), label: "Activity" },
  ];
  return (
    <div className="min-h-screen md:grid md:grid-cols-[220px_1fr]">
      <aside className="border-b border-line bg-surface/60 p-4 md:sticky md:top-0 md:h-screen md:border-r md:border-b-0 md:p-5">
        <div className="flex items-center justify-between md:block">
          <Logo />
          <p className="text-xs tracking-[0.2em] text-muted uppercase md:mt-2">Office</p>
        </div>
        <AdminNav links={links} />
        <form action={logout} className="mt-4 md:absolute md:bottom-5">
          <button className="text-sm text-muted hover:text-fg">Sign out</button>
        </form>
      </aside>
      <main className="min-w-0 p-4 sm:p-8">{children}</main>
    </div>
  );
}
