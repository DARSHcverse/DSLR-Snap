import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { isBot } from "./cloudRules";
import { licencePrivateKey } from "./config";
import { ipFrom } from "./rateLimit";
import { supabaseAdmin } from "./supabase/server";

export type HitKind = "view" | "session_view" | "download" | "zip" | "slideshow";

export interface Visitor {
  ua: string | null;
  ip: string;
}

/** Read in the page/route itself: request data isn't available inside after() in a page. */
export async function visitor(): Promise<Visitor> {
  const h = await headers();
  return { ua: h.get("user-agent"), ip: ipFrom(h) };
}

/**
 * Counts one gallery event for the operator's analytics. No cookies: a visitor is a hash of IP,
 * browser and the day with a server secret, so it can't be reversed and resets every day. Bots
 * and link previews aren't counted. Never throws: analytics must not break a gallery.
 */
export async function recordHit(eventId: string, kind: HitKind, who: Visitor): Promise<void> {
  try {
    const { ua, ip } = who;
    if (isBot(ua)) return;
    const day = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
    const visitor = createHash("sha256").update(`${licencePrivateKey}|${ip}|${ua}|${day}`).digest("base64url").slice(0, 22);
    await supabaseAdmin().rpc("record_gallery_hit", { p_event: eventId, p_kind: kind, p_visitor: kind === "download" || kind === "zip" ? null : visitor });
  } catch (e) {
    console.error("gallery stats:", e);
  }
}

export interface EventStats {
  totals: { views: number; visitors: number; sessionViews: number; downloads: number; zips: number; slideshows: number };
  days: { day: string; views: number; visitors: number; downloads: number }[];
}

/** The last `days` days, oldest first (missing days filled with zeros), plus all-time totals. */
export async function statsForEvent(eventId: string, days = 30): Promise<EventStats> {
  const db = supabaseAdmin();
  const [{ data: rows }, { data: visitors }] = await Promise.all([
    db.from("gallery_stats").select("day, views, session_views, downloads, zips, slideshows").eq("event_id", eventId),
    db.from("gallery_visitors").select("day").eq("event_id", eventId),
  ]);
  const visitorsByDay = new Map<string, number>();
  for (const v of visitors ?? []) visitorsByDay.set(v.day, (visitorsByDay.get(v.day) ?? 0) + 1);
  const byDay = new Map((rows ?? []).map((r) => [r.day as string, r]));
  const sum = (k: "views" | "session_views" | "downloads" | "zips" | "slideshows") => (rows ?? []).reduce((n, r) => n + (r[k] as number), 0);

  const today = new Date(new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" }) + "T12:00:00Z");
  const series = Array.from({ length: days }, (_, i) => {
    const d = new Date(today.getTime() - (days - 1 - i) * 86_400_000).toISOString().slice(0, 10);
    const r = byDay.get(d);
    return { day: d, views: (r?.views ?? 0) + (r?.session_views ?? 0), visitors: visitorsByDay.get(d) ?? 0, downloads: (r?.downloads ?? 0) + (r?.zips ?? 0) };
  });
  return {
    totals: { views: sum("views"), visitors: (visitors ?? []).length, sessionViews: sum("session_views"), downloads: sum("downloads"), zips: sum("zips"), slideshows: sum("slideshows") },
    days: series,
  };
}
