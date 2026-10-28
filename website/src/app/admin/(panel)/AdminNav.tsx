"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AdminNav({ links }: { links: { href: string; label: string; badge?: number }[] }) {
  const path = usePathname();
  // The dashboard's link is the admin root, so it only matches exactly; the rest match their section.
  const isOn = (href: string, i: number) => (i === 0 ? path === href : path === href || path.startsWith(`${href}/`));
  return (
    <nav className="mt-4 flex gap-1 overflow-x-auto md:mt-8 md:flex-col">
      {links.map((l, i) => (
        <Link
          key={l.href}
          href={l.href}
          className={`rounded-[10px] px-3 py-2 text-sm whitespace-nowrap transition-colors ${isOn(l.href, i) ? "bg-surface-2 font-semibold text-fg" : "text-muted hover:bg-surface-2 hover:text-fg"}`}
        >
          {l.label}
          {!!l.badge && <span className="ml-2 rounded-full bg-accent px-1.5 py-0.5 text-[11px] font-bold text-accent-ink">{l.badge}</span>}
        </Link>
      ))}
    </nav>
  );
}
