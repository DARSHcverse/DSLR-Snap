/**
 * Website click and visit tracking: the rules shared by the browser tracker, the /api/t endpoint and
 * the admin. First-party and cookieless; see siteEvents.ts for how a visitor is counted.
 */

export const EVENTS = {
  view: "Page view",
  download: "Downloaded the app",
  download_click: "Clicked Download (to the download page)",
  signup_click: "Clicked Sign up / Start free",
  login_click: "Clicked Log in",
  pricing_click: "Clicked Pricing",
  checkout_started: "Started checkout",
  contact_click: "Clicked email or phone",
  guide_pdf: "Downloaded the user guide PDF",
  outbound: "Left for another site",
  cta: "Clicked a tracked button",
} as const;
export type EventName = keyof typeof EVENTS;

/** What the browser may report. Downloads and checkouts are recorded by the server only. */
export const BROWSER_EVENTS = new Set<EventName>(["view", "download_click", "signup_click", "login_click", "pricing_click", "contact_click", "guide_pdf", "outbound", "cta"]);

/** Trimmed, one line, no control characters, at most `max` long; null when empty. */
export function clean(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const s = v.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
  return s || null;
}

/**
 * The path to store for a page, or null when it must not be tracked: private links (guest
 * galleries, host pages, app sign-in, auth callbacks), the API and the admin. Account pages keep
 * only their section so ids never end up in the stats.
 */
export function trackedPath(raw: unknown, adminPath?: string | null): string | null {
  if (typeof raw !== "string" || !raw.startsWith("/") || raw.startsWith("//")) return null;
  const path = raw.split(/[?#]/)[0].slice(0, 200).replace(/\/+$/, "") || "/";
  if (/^\/(e|b|s|app|auth|api|email)(\/|$)/.test(path)) return null;
  if (adminPath && (path === `/${adminPath}` || path.startsWith(`/${adminPath}/`))) return null;
  if (path.startsWith("/account")) return path.split("/").slice(0, 3).join("/");
  return /^[\w\-/.]*$/.test(path) ? path : null;
}

// First match wins, so Gemini comes before Google.
const SOURCES: [RegExp, string][] = [
  [/^gemini\.google\.com$/, "Gemini"],
  [/(^|\.)google\./, "Google"],
  [/(^|\.)bing\.com$/, "Bing"],
  [/(^|\.)duckduckgo\.com$/, "DuckDuckGo"],
  [/(^|\.)yahoo\./, "Yahoo"],
  [/(^|\.)ecosia\.org$/, "Ecosia"],
  [/(^|\.)(chatgpt\.com|openai\.com)$/, "ChatGPT"],
  [/(^|\.)perplexity\.ai$/, "Perplexity"],
  [/(^|\.)claude\.ai$/, "Claude"],
  [/(^|\.)(facebook\.com|fb\.com|fb\.me)$/, "Facebook"],
  [/(^|\.)instagram\.com$/, "Instagram"],
  [/(^|\.)(youtube\.com|youtu\.be)$/, "YouTube"],
  [/(^|\.)tiktok\.com$/, "TikTok"],
  [/(^|\.)(t\.co|x\.com|twitter\.com)$/, "X"],
  [/(^|\.)linkedin\.com$|^lnkd\.in$/, "LinkedIn"],
  [/(^|\.)reddit\.com$/, "Reddit"],
  [/(^|\.)pinterest\./, "Pinterest"],
];

/** Where a visit came from: the utm_source tag if the link had one, otherwise the referring site. */
export function sourceFrom(referrer: unknown, utmSource: unknown, ownHost: string | null): string | null {
  const utm = clean(utmSource, 40);
  if (utm) return utm.toLowerCase();
  if (typeof referrer !== "string" || !referrer) return null;
  let host: string;
  try {
    host = new URL(referrer).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
  if (!host || (ownHost && host === ownHost.toLowerCase().replace(/^www\./, "").split(":")[0])) return null;
  return SOURCES.find(([re]) => re.test(host))?.[1] ?? host.slice(0, 60);
}

export function deviceFrom(ua: string | null): "phone" | "tablet" | "computer" {
  const s = ua ?? "";
  if (/iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(s)) return "tablet";
  if (/Mobi|iPhone|iPod|Android.*Mobile|Windows Phone/i.test(s)) return "phone";
  return "computer";
}

/** Where a download came from (?from=…): a short, known word or nothing. */
export function downloadFrom(v: unknown): string {
  const s = typeof v === "string" ? v.toLowerCase() : "";
  return /^[a-z][a-z-]{0,23}$/.test(s) ? s : "direct";
}
