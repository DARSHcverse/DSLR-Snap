import Link from "next/link";
import { accountsEnabled } from "@/lib/config";
import { earlyAccessHref } from "@/lib/site";
import { AccountLinks } from "./AccountLinks";
import { Logo } from "./Logo";

const NAV = [
  { href: "/features", label: "Features" },
  { href: "/solutions/360-photo-booth-software", label: "360" },
  { href: "/pricing", label: "Pricing" },
  { href: "/download", label: "Download" },
  { href: "/support", label: "Support" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-line/60 bg-bg/80 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4 sm:gap-6 sm:px-6">
        <Link href="/" aria-label="DSLR Snap home">
          <Logo />
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-[10px] px-3.5 py-2 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-fg"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        {/* Phones: a plain disclosure menu (no JavaScript). */}
        <details className="group relative ml-auto shrink-0 md:hidden">
          <summary aria-label="Menu" className="flex size-10 cursor-pointer list-none items-center justify-center rounded-[10px] text-muted hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </summary>
          <nav aria-label="Menu" className="absolute right-0 mt-2 flex w-52 flex-col rounded-card border border-line bg-surface p-2 shadow-2xl">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="rounded-[10px] px-3 py-2.5 text-sm hover:bg-surface-2">
                {item.label}
              </Link>
            ))}
          </nav>
        </details>
        {accountsEnabled ? (
          <AccountLinks />
        ) : (
          <a
            href={earlyAccessHref}
            className="rounded-full bg-accent px-4 py-2 text-sm font-semibold whitespace-nowrap text-accent-ink transition-transform active:scale-[0.97]"
          >
            Get early access
          </a>
        )}
      </div>
    </header>
  );
}
