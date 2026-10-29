import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import type { ResolvedDesign } from "@/lib/cloudDesign";
import { designVars } from "@/lib/design";
import { Logo } from "../Logo";

/**
 * Guest-facing frame in the event's own look (colours, font, background, banner, logo), with a quiet
 * "made with DSLR Snap" credit last. Without a design it's DSLR Snap's own dark look.
 */
export function GalleryShell({ children, look }: { children: ReactNode; look?: ResolvedDesign }) {
  const vars = (look ? designVars(look.design) : {}) as CSSProperties;
  const bg = look?.images.background;
  return (
    <div
      style={vars}
      className="relative flex min-h-dvh flex-col bg-[radial-gradient(120%_40%_at_50%_0%,var(--color-booth-glow)_0%,var(--color-bg)_60%)] text-fg"
    >
      {bg && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed storage URL */}
          <img src={bg} alt="" className="pointer-events-none fixed inset-0 -z-0 size-full object-cover" />
          <div className="pointer-events-none fixed inset-0 bg-[var(--color-bg)] opacity-80" />
        </>
      )}
      {(look?.images.banner || look?.images.logo) && (
        <header className="relative">
          {look.images.banner && (
            // eslint-disable-next-line @next/next/no-img-element -- short-lived signed storage URL
            <img src={look.images.banner} alt="" className="max-h-72 w-full object-cover" />
          )}
          {look.images.logo && (
            <div className={`mx-auto flex max-w-5xl justify-center px-4 ${look.images.banner ? "-mt-12" : "pt-10"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed storage URL */}
              <img src={look.images.logo} alt="" className="max-h-24 max-w-[240px] rounded-2xl bg-[var(--color-bg)] object-contain p-2 shadow-lg" />
            </div>
          )}
        </header>
      )}
      <main className="relative mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6 sm:py-14">{children}</main>
      <footer className="relative border-t border-line/60 py-6 text-center text-sm text-muted">
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
