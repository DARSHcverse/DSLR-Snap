import type { ReactNode } from "react";
import { Footer } from "./Footer";
import { Header } from "./Header";

/** Frame for account pages: site header, a centred column, footer. */
export function PageShell({ title, intro, children, wide }: { title: string; intro?: ReactNode; children: ReactNode; wide?: boolean }) {
  return (
    <>
      <Header />
      <main className="bg-[radial-gradient(120%_50%_at_50%_0%,var(--color-booth-glow)_0%,var(--color-bg)_60%)]">
        <div className={`mx-auto px-4 py-16 sm:px-6 sm:py-24 ${wide ? "max-w-3xl" : "max-w-md"}`}>
          <h1 className="font-display text-3xl font-bold tracking-[-0.02em] text-balance sm:text-4xl">{title}</h1>
          {intro && <p className="mt-3 text-pretty text-muted">{intro}</p>}
          <div className="mt-8">{children}</div>
        </div>
      </main>
      <Footer />
    </>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-card border border-line bg-surface p-6 ${className}`}>{children}</div>;
}

/** Shown on account pages until Supabase is connected. */
export function NotReady() {
  return (
    <Card>
      <p className="font-semibold">Accounts open soon</p>
      <p className="mt-2 text-muted">
        DSLR Snap is in early access. Email us and we&apos;ll set you up.
      </p>
    </Card>
  );
}
