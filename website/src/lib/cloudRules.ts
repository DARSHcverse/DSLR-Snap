import { cleanWebsite } from "./gallery";

/** Link previews (WhatsApp, Facebook, Slack…), crawlers and scripts don't count as gallery views. */
export function isBot(userAgent: string | null | undefined): boolean {
  const ua = (userAgent ?? "").trim();
  return !ua || /bot|crawl|spider|slurp|preview|whatsapp|facebookexternalhit|embedly|skype|telegram|discord|curl|wget|python|headless|lighthouse/i.test(ua);
}

/** Addresses that would clash with the site or impersonate it. */
export const RESERVED_SLUGS = new Set(["admin", "account", "accounts", "api", "app", "dslrsnap", "dslr-snap", "support", "help", "login", "signup", "pricing", "download", "official", "team"]);

/** "Photo Booth Hire Swansea!" → "photo-booth-hire-swansea"; null when unusable. */
export function cleanSlug(raw: string): string | null {
  const s = raw.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40).replace(/-+$/, "");
  if (s.length < 2 || RESERVED_SLUGS.has(s)) return null;
  return s;
}

export interface HomepageLink {
  label: string;
  url: string;
}

/** Up to five http(s) links; an empty label becomes the site's name. */
export function parseLinks(raw: unknown): HomepageLink[] {
  if (!Array.isArray(raw)) return [];
  const out: HomepageLink[] = [];
  for (const item of raw) {
    const r = (item ?? {}) as Record<string, unknown>;
    const url = typeof r.url === "string" ? cleanWebsite(r.url) : null;
    if (!url) continue;
    const label = (typeof r.label === "string" ? r.label.trim().slice(0, 40) : "") || new URL(url).hostname.replace(/^www\./, "");
    out.push({ label, url });
    if (out.length === 5) break;
  }
  return out;
}
