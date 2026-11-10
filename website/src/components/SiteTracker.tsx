"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Reports page views and important clicks to /api/t for the admin's Website page. Stores nothing in
 * the browser (no cookies, no storage), and stays silent when the browser asks not to be tracked.
 * Clicks are recognised by where a link goes, so buttons don't need any markup; anything else can
 * opt in with data-track="what it is". data-track-area names a part of a page ("hero", "pricing").
 */
const PRIVATE = /^\/(e|b|s|app|auth|api|email)(\/|$)/;
let firstView = true;

function optedOut(): boolean {
  const n = navigator as Navigator & { globalPrivacyControl?: boolean };
  return n.globalPrivacyControl === true || n.doNotTrack === "1";
}

function send(body: Record<string, string | undefined>) {
  try {
    const data = JSON.stringify(body);
    if (!navigator.sendBeacon?.("/api/t", data)) void fetch("/api/t", { method: "POST", body: data, keepalive: true });
  } catch {
    // Tracking must never get in the way.
  }
}

function area(el: Element): string {
  const named = el.closest<HTMLElement>("[data-track-area]")?.dataset.trackArea;
  if (named) return named;
  if (el.closest("header")) return "header";
  if (el.closest("footer")) return "footer";
  if (el.closest("nav, aside")) return "menu";
  return "page";
}

const words = (el: Element) => (el.getAttribute("aria-label") || (el as HTMLElement).innerText || "").replace(/\s+/g, " ").trim().slice(0, 40);

/** The event a click on this element counts as, or null for clicks that don't matter. */
function clickEvent(target: Element): { n: string; l: string } | null {
  const tagged = target.closest<HTMLElement>("[data-track]");
  if (tagged) return { n: "cta", l: `${area(tagged)} · ${tagged.dataset.track}` };
  const a = target.closest<HTMLAnchorElement>("a[href]");
  if (!a) return null;
  const url = new URL(a.href, location.href);
  const where = `${area(a)} · ${words(a)}`;
  if (url.protocol === "mailto:" || url.protocol === "tel:") return { n: "contact_click", l: `${area(a)} · ${url.protocol === "tel:" ? "phone" : "email"}` };
  if (url.origin !== location.origin) {
    if (url.hostname.startsWith("downloads.")) return null; // installer links count on the server
    return { n: "outbound", l: `${area(a)} · ${url.hostname.replace(/^www\./, "")}` };
  }
  const path = url.pathname.replace(/\/+$/, "") || "/";
  if (path.endsWith(".pdf")) return { n: "guide_pdf", l: where };
  if (path === "/signup") return { n: "signup_click", l: url.searchParams.get("plan") ? `${where} · ${url.searchParams.get("plan")}` : where };
  if (path === "/login") return { n: "login_click", l: where };
  if (path === "/download") return { n: "download_click", l: where };
  if (path === "/pricing") return { n: "pricing_click", l: where };
  return null; // /download/windows and checkouts are counted on the server
}

export function SiteTracker() {
  const path = usePathname();

  useEffect(() => {
    if (optedOut() || PRIVATE.test(path)) return;
    // Where the visit came from only matters on the first page; later pages are this site's own.
    const utm = firstView ? new URLSearchParams(location.search).get("utm_source") ?? undefined : undefined;
    send({ n: "view", p: path, r: firstView ? document.referrer : undefined, u: utm });
    firstView = false;
  }, [path]);

  useEffect(() => {
    if (optedOut()) return;
    const onClick = (e: MouseEvent) => {
      if (PRIVATE.test(location.pathname) || !(e.target instanceof Element)) return;
      const ev = clickEvent(e.target);
      if (ev) send({ ...ev, p: location.pathname });
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);

  return null;
}
