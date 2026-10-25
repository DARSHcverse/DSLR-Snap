import { earlyAccessHref } from "@/lib/site";
import { Logo } from "./Logo";

const NAV = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#hardware", label: "Hardware" },
  { href: "#faq", label: "FAQ" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-line/60 bg-bg/80 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-4 sm:px-6">
        <a href="#top" aria-label="DSLR Snap home">
          <Logo />
        </a>
        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-[10px] px-3.5 py-2 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-fg"
            >
              {item.label}
            </a>
          ))}
        </nav>
        <a
          href={earlyAccessHref}
          className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition-transform active:scale-[0.97]"
        >
          Get early access
        </a>
      </div>
    </header>
  );
}
