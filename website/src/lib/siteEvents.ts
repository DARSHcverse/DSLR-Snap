import "server-only";
import { createHash } from "node:crypto";
import { isBot } from "./cloudRules";
import { licencePrivateKey, supabaseConfig } from "./config";
import { ipFrom } from "./rateLimit";
import { supabaseAdmin, supabaseForRequest } from "./supabase/server";
import { deviceFrom, type EventName } from "./track";

export interface SiteEventRow {
  name: EventName;
  label: string | null;
  path: string | null;
  source: string | null;
  visitor: string | null;
  user_id: string | null;
  country: string | null;
  device: "phone" | "tablet" | "computer";
}

/** The browser asked not to be tracked (Global Privacy Control or Do Not Track). */
export const optedOut = (h: Headers) => h.get("sec-gpc") === "1" || h.get("dnt") === "1";

/** The signed-in account's id from the session cookie, verified, or null. Never throws. */
async function signedInId(h: Headers): Promise<string | null> {
  if (!supabaseConfig || !/(^|;\s*)sb-[^=]*-auth-token/.test(h.get("cookie") ?? "")) return null;
  try {
    const { data } = await (await supabaseForRequest()).auth.getClaims();
    return typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  } catch {
    return null;
  }
}

/**
 * One event as it will be stored, or null for bots. No cookies: a visitor is a hash of IP, browser
 * and the day with a server secret, so it can't be reversed and resets every day (the same scheme
 * as the gallery stats). `anonymous` drops the visitor code and the account (opted-out browsers).
 * Read this in the request itself: it needs the request's headers and cookies.
 */
export async function siteEvent(
  h: Headers,
  e: { name: EventName; label?: string | null; path?: string | null; source?: string | null },
  { anonymous = false } = {},
): Promise<SiteEventRow | null> {
  const ua = h.get("user-agent");
  if (isBot(ua)) return null;
  const day = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
  const visitor = anonymous ? null : createHash("sha256").update(`site|${licencePrivateKey}|${ipFrom(h)}|${ua}|${day}`).digest("base64url").slice(0, 22);
  const country = h.get("x-vercel-ip-country")?.toUpperCase() ?? "";
  return {
    name: e.name,
    label: e.label ?? null,
    path: e.path ?? null,
    source: e.source ?? null,
    visitor,
    user_id: anonymous ? null : await signedInId(h),
    country: /^[A-Z]{2}$/.test(country) ? country : null,
    device: deviceFrom(ua),
  };
}

/** Stores an event. Never throws: tracking must not break a page, a download or a checkout. */
export async function saveSiteEvent(row: SiteEventRow | null): Promise<void> {
  if (!row || !supabaseConfig) return;
  try {
    const { error } = await supabaseAdmin().from("site_events").insert(row);
    if (error) console.error("site event:", error.message);
  } catch (e) {
    console.error("site event:", e);
  }
}
