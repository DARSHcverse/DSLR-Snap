import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "../Logo";

/** Guest-facing frame: the event's photos first, a quiet "made with DSLR Snap" credit last. */
export function GalleryShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-[radial-gradient(120%_40%_at_50%_0%,var(--color-booth-glow)_0%,var(--color-bg)_60%)]">
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6 sm:py-14">{children}</main>
      <footer className="border-t border-line/60 py-6 text-center text-sm text-muted">
        <Link href="/" className="inline-flex items-center gap-2 hover:text-fg">
          Made with <Logo />
        </Link>
      </footer>
    </div>
  );
}

export function GalleryNotice({ title, body, children }: { title: string; body: string; children?: ReactNode }) {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="font-display text-3xl font-bold tracking-[-0.02em] text-balance">{title}</h1>
      <p className="mt-3 text-pretty text-muted">{body}</p>
      {children}
    </div>
  );
}
