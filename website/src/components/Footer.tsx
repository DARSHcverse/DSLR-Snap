import Link from "next/link";
import { SOLUTIONS } from "@/lib/marketing";
import { site, tradingName } from "@/lib/site";
import { ChatButton } from "./AccountLinks";
import { Logo } from "./Logo";

// Cached so the page can stay static; Next refreshes it on revalidation.
async function CopyrightYear() {
  "use cache";
  return new Date().getFullYear();
}

const COLUMNS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Product",
    links: [
      { href: "/features", label: "Features" },
      { href: "/pricing", label: "Pricing" },
      { href: "/download", label: "Download" },
      { href: "/compare/dslrbooth", label: "vs dslrBooth" },
      { href: "/account", label: "Your account" },
    ],
  },
  {
    title: "Booths",
    links: SOLUTIONS.map((s) => ({ href: `/solutions/${s.slug}`, label: s.name })),
  },
  {
    title: "Help",
    links: [
      { href: "/support", label: "Support" },
      { href: "/support#contact", label: "Contact us" },
      { href: "/terms", label: "Terms" },
      { href: "/privacy", label: "Privacy" },
      { href: "/refunds", label: "Refunds" },
    ],
  },
];

const SOCIAL_LABELS: Record<keyof typeof site.social, string> = { instagram: "Instagram", facebook: "Facebook", youtube: "YouTube", tiktok: "TikTok" };

export function Footer() {
  const socials = (Object.keys(site.social) as (keyof typeof site.social)[]).filter((k) => site.social[k]);
  return (
    <footer className="border-t border-line">
      <ChatButton />
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.3fr_repeat(3,1fr)]">
        <div className="flex flex-col gap-3">
          <Logo />
          <p className="text-sm text-muted">Photo booth software for Windows.</p>
          <a href={`mailto:${site.supportEmail}`} className="text-sm text-muted hover:text-fg">{site.supportEmail}</a>
          {socials.length > 0 && (
            <p className="flex gap-3 text-sm">
              {socials.map((k) => (
                <a key={k} href={site.social[k]} rel="me noopener" target="_blank" className="text-muted hover:text-fg">{SOCIAL_LABELS[k]}</a>
              ))}
            </p>
          )}
        </div>
        {COLUMNS.map((c) => (
          <nav key={c.title} aria-label={c.title} className="flex flex-col gap-2 text-sm">
            <p className="font-semibold">{c.title}</p>
            {c.links.map((l) => (
              <Link key={l.href} href={l.href} className="text-muted hover:text-fg">{l.label}</Link>
            ))}
          </nav>
        ))}
      </div>
      <div className="border-t border-line/60">
        <p className="mx-auto max-w-6xl px-4 py-6 text-xs text-muted sm:px-6">
          © <CopyrightYear /> {tradingName}
          {site.business.companyNumber ? ` · Company no. ${site.business.companyNumber}` : ""}
          {site.business.vatNumber ? ` · VAT ${site.business.vatNumber}` : ""}. Canon, Nikon, GoPro, DNP, Microsoft, Windows and Surface are trademarks of their respective owners.
        </p>
      </div>
    </footer>
  );
}
