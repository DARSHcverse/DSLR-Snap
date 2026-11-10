import { after } from "next/server";
import { ipFrom, overLimit } from "@/lib/rateLimit";
import { optedOut, saveSiteEvent, siteEvent } from "@/lib/siteEvents";
import { BROWSER_EVENTS, clean, type EventName, sourceFrom, trackedPath } from "@/lib/track";

const ADMIN_PATH = process.env.ADMIN_PATH?.replace(/^\/+|\/+$/g, "") || null;
const done = () => new Response(null, { status: 204 });

/** Only the site's own pages may report (beacons send an Origin header). */
function sameSite(h: Headers): boolean {
  const origin = h.get("origin");
  if (!origin) return h.get("sec-fetch-site") !== "cross-site";
  try {
    return new URL(origin).host === h.get("host");
  } catch {
    return false;
  }
}

/**
 * A page view or an important click from the site's own pages (components/SiteTracker.tsx).
 * Always answers 204 so a broken or refused event never shows up for the visitor.
 */
export async function POST(request: Request) {
  const h = request.headers;
  if (optedOut(h) || !sameSite(h)) return done();

  const text = await request.text();
  if (text.length > 2000) return done();
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(text);
  } catch {
    return done();
  }
  const name = body.n as EventName;
  const path = trackedPath(body.p, ADMIN_PATH);
  if (!BROWSER_EVENTS.has(name) || !path) return done();

  const row = await siteEvent(h, {
    name,
    path,
    label: name === "view" ? null : clean(body.l, 120),
    source: name === "view" ? sourceFrom(body.r, body.u, h.get("host")) : null,
  });
  const ip = ipFrom(h);
  after(async () => {
    if (row && !(await overLimit("track", ip))) await saveSiteEvent(row);
  });
  return done();
}
