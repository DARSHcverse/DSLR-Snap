import "server-only";
import { designForEvent, type ResolvedDesign } from "./cloudDesign";
import { cleanSlug, type HomepageLink, parseLinks } from "./cloudRules";
import { cleanWebsite, type GalleryFile, RETENTION_DAYS } from "./gallery";
import { previewPath } from "./galleryServer";
import { viewUrls } from "./storage";
import { supabaseAdmin } from "./supabase/server";

/**
 * The operator's public homepage (dslrsnap.com/b/<slug>): their brand, links and the events they chose
 * to show. Only events marked "show on my homepage", with the link on and no password, are listed.
 */
export interface HomepageSettings {
  enabled: boolean;
  slug: string | null;
  name: string;
  tagline: string;
  bookUrl: string | null;
  links: HomepageLink[];
}

export async function homepageSettings(userId: string): Promise<HomepageSettings> {
  const { data } = await supabaseAdmin()
    .from("customer_profiles")
    .select("homepage_enabled, business_slug, business_name, business_tagline, book_url, business_links")
    .eq("user_id", userId)
    .maybeSingle();
  return {
    enabled: !!data?.homepage_enabled,
    slug: data?.business_slug ?? null,
    name: data?.business_name ?? "",
    tagline: data?.business_tagline ?? "",
    bookUrl: data?.book_url ?? null,
    links: parseLinks(data?.business_links),
  };
}

export async function saveHomepage(
  userId: string,
  s: { enabled: boolean; slug: string; name: string; tagline: string; bookUrl: string; links: unknown },
): Promise<{ error?: string }> {
  const slug = cleanSlug(s.slug || s.name);
  if (!slug) return { error: "Choose an address with at least 2 letters or numbers (some words are reserved)." };
  const db = supabaseAdmin();
  const { data: taken } = await db.from("customer_profiles").select("user_id").eq("business_slug", slug).neq("user_id", userId).maybeSingle();
  if (taken) return { error: `dslrsnap.com/b/${slug} is taken. Try another address.` };
  const bookRaw = s.bookUrl.trim();
  const bookUrl = bookRaw ? cleanWebsite(bookRaw) : null;
  if (bookRaw && !bookUrl) return { error: "The booking link doesn't look right." };
  const { error } = await db.from("customer_profiles").upsert({
    user_id: userId,
    homepage_enabled: s.enabled,
    business_slug: slug,
    business_name: s.name.trim().slice(0, 80) || null,
    business_tagline: s.tagline.trim().slice(0, 160) || null,
    book_url: bookUrl,
    business_links: parseLinks(s.links),
  });
  return error ? { error: error.message } : {};
}

export async function setShowOnHomepage(userId: string, eventId: string, on: boolean): Promise<void> {
  await supabaseAdmin().from("gallery_events").update({ show_on_homepage: on }).eq("id", eventId).eq("user_id", userId);
}

export interface PublicHomepage {
  slug: string;
  name: string;
  tagline: string;
  bookUrl: string | null;
  links: HomepageLink[];
  look: ResolvedDesign;
  events: { name: string; date: string | null; url: string; cover: string | null; count: number }[];
}

/** The public page for an address; null when it doesn't exist or the operator turned it off. */
export async function publicHomepage(slugRaw: string): Promise<PublicHomepage | null> {
  const slug = cleanSlug(slugRaw);
  if (!slug || slug !== slugRaw) return null;
  const db = supabaseAdmin();
  const { data: p } = await db
    .from("customer_profiles")
    .select("user_id, homepage_enabled, business_name, business_tagline, book_url, business_links, brand_design")
    .eq("business_slug", slug)
    .maybeSingle();
  if (!p?.homepage_enabled) return null;

  const { data: events } = await db
    .from("gallery_events")
    .select("id, name, event_date, share_token, cover_session_id, created_at")
    .eq("user_id", p.user_id)
    .eq("show_on_homepage", true)
    .eq("link_enabled", true)
    .is("password_hash", null);
  const ids = (events ?? []).map((e) => e.id);
  const { data: sessions } = ids.length
    ? await db
        .from("gallery_sessions")
        .select("id, event_id, files, created_at")
        .in("event_id", ids)
        .is("hidden_at", null)
        .not("ready_at", "is", null)
        .gt("created_at", new Date(Date.now() - RETENTION_DAYS * 86_400_000).toISOString())
        .order("created_at", { ascending: false })
    : { data: [] };
  type Row = { id: string; event_id: string; files: GalleryFile[] };
  const byEvent = new Map<string, Row[]>();
  for (const s of (sessions ?? []) as Row[]) byEvent.set(s.event_id, [...(byEvent.get(s.event_id) ?? []), s]);
  const cards = (events ?? [])
    .map((e) => {
      const rows = byEvent.get(e.id) ?? [];
      const cover = rows.find((r) => r.id === e.cover_session_id) ?? rows[0];
      return { e, rows, coverPath: cover ? previewPath(cover.files) : undefined };
    })
    .filter((c) => c.rows.length > 0)
    .sort((a, b) => String(b.e.event_date ?? b.e.created_at).localeCompare(String(a.e.event_date ?? a.e.created_at)));
  const urls = await viewUrls(cards.flatMap((c) => (c.coverPath ? [c.coverPath] : [])));

  return {
    slug,
    name: p.business_name ?? "Photo booth",
    tagline: p.business_tagline ?? "",
    bookUrl: p.book_url,
    links: parseLinks(p.business_links),
    look: await designForEvent(p.user_id, p.brand_design),
    events: cards.map((c) => ({ name: c.e.name, date: c.e.event_date, url: `/e/${c.e.share_token}`, cover: c.coverPath ? (urls.get(c.coverPath) ?? null) : null, count: c.rows.length })),
  };
}
