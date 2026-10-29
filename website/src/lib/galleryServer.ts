import "server-only";
import { createHmac } from "node:crypto";
import { describeFiles, type GalleryFile, type GalleryFileKind, isExpired, isVideo, makeShareToken, RETENTION_DAYS } from "./gallery";
import { licencePrivateKey } from "./config";
import { designForEvent, type ResolvedDesign } from "./cloudDesign";
import { viewUrls } from "./storage";
import { supabaseAdmin } from "./supabase/server";

/** The account's gallery record for a booth event, created on first use (with the host's share token). */
export async function galleryEventFor(
  userId: string,
  event: { id: string; name: string; date: string | null },
): Promise<{ id: string; share_token: string }> {
  const db = supabaseAdmin();
  const { data: existing } = await db
    .from("gallery_events")
    .select("id, share_token, edited_at")
    .eq("user_id", userId)
    .eq("app_event_id", event.id)
    .maybeSingle();
  if (existing) {
    // Once the operator renames the event in the cloud, the booth's name and date no longer overwrite it.
    if (!existing.edited_at) await db.from("gallery_events").update({ name: event.name, event_date: event.date }).eq("id", existing.id);
    return existing;
  }
  const { data, error } = await db
    .from("gallery_events")
    .upsert(
      { user_id: userId, app_event_id: event.id, name: event.name, event_date: event.date, share_token: makeShareToken() },
      { onConflict: "user_id,app_event_id", ignoreDuplicates: false },
    )
    .select("id, share_token")
    .single();
  if (error || !data) throw new Error(`Could not save gallery event: ${error?.message}`);
  return data;
}

/** The small preview when the booth sent one, else the full photo. */
export const previewPath = (files: GalleryFile[]) => files.find((f) => f.kind === "thumb")?.path ?? files.find((f) => f.kind === "photo")?.path;

export type SessionGallery =
  | { state: "waiting" }
  | { state: "expired" }
  | {
      state: "ready";
      eventId: string;
      eventName: string | null;
      /** The whole event's page, when the operator lets guests browse everyone's photos. */
      eventUrl: string | null;
      website: string | null;
      look: ResolvedDesign;
      items: { kind: GalleryFileKind; label: string; video: boolean; view?: string }[];
    };

/** A guest session's photos with short-lived view and download links. Always reachable from its own QR. */
export async function loadSessionGallery(id: string): Promise<SessionGallery> {
  const db = supabaseAdmin();
  const { data } = await db
    .from("gallery_sessions")
    .select("files, ready_at, created_at, user_id, event_id, gallery_events(name, share_token, guest_access, link_enabled, website_url, design)")
    .eq("id", id)
    .maybeSingle();
  // The QR appears before the upload finishes (even offline), so "not there yet" is normal.
  if (!data?.ready_at) return { state: "waiting" };
  if (isExpired(data.created_at, Date.now())) return { state: "expired" };

  const files = data.files as GalleryFile[];
  const shown = describeFiles(files);
  const pathOf = (kind: GalleryFileKind) => files.find((f) => f.kind === kind)!.path;
  // Downloads go through /s/<id>/get/<kind>, which counts them and signs the link on demand.
  const view = await viewUrls(shown.map((d) => pathOf(d.kind)));
  const event = data.gallery_events as unknown as { name: string; share_token: string; guest_access: string; link_enabled: boolean; website_url: string | null; design: unknown } | null;
  const look = await designForEvent(data.user_id, event?.design ?? null);
  return {
    state: "ready",
    eventId: data.event_id,
    eventName: event?.name ?? null,
    eventUrl: event && event.guest_access === "all" && event.link_enabled ? `/e/${event.share_token}` : null,
    website: event?.website_url ?? null,
    look,
    items: shown.map((d) => ({ kind: d.kind, label: d.label, video: isVideo(d.kind), view: view.get(pathOf(d.kind)) })),
  };
}

// ---------- The host's event page (/e/…) ----------

/** Proof, kept in a cookie, that this browser entered the event's password (changes when the password does). */
export function passwordPass(eventId: string, passwordHash: string): string {
  return createHmac("sha256", `gallery-pass:${licencePrivateKey}`).update(`${eventId}:${passwordHash}`).digest("base64url");
}
export const passCookieName = (eventId: string) => `dsg_${eventId.replace(/-/g, "").slice(0, 16)}`;

export interface PublicEvent {
  id: string;
  userId: string;
  design: unknown;
  name: string;
  date: string | null;
  showDate: boolean;
  website: string | null;
  allowDownloadAll: boolean;
  passwordHash: string | null;
  linkEnabled: boolean;
}

export async function publicEventByToken(token: string): Promise<PublicEvent | null> {
  const { data: e } = await supabaseAdmin()
    .from("gallery_events")
    .select("id, user_id, design, name, event_date, show_date, website_url, allow_download_all, password_hash, link_enabled")
    .eq("share_token", token)
    .maybeSingle();
  if (!e) return null;
  return { id: e.id, userId: e.user_id, design: e.design, name: e.name, date: e.event_date, showDate: e.show_date, website: e.website_url, allowDownloadAll: e.allow_download_all, passwordHash: e.password_hash, linkEnabled: e.link_enabled };
}

/** The event's visible sessions, newest first, with a preview link for each. */
/** `full` uses the full photo (slideshows on a TV) instead of the small preview (grids). */
export async function eventSessions(eventId: string, opts: { includeHidden?: boolean; limit?: number; full?: boolean; album?: string } = {}) {
  const db = supabaseAdmin();
  let q = db
    .from("gallery_sessions")
    .select("id, files, created_at, hidden_at, album_id")
    .eq("event_id", eventId)
    .not("ready_at", "is", null)
    .gt("created_at", new Date(Date.now() - RETENTION_DAYS * 86_400_000).toISOString())
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 2000);
  if (!opts.includeHidden) q = q.is("hidden_at", null);
  if (opts.album) q = q.eq("album_id", opts.album);
  const { data: rows } = await q;
  const list = ((rows ?? []) as { id: string; files: GalleryFile[]; created_at: string; hidden_at: string | null; album_id: string | null }[]).flatMap((s) => {
    const preview = opts.full ? s.files.find((f) => f.kind === "photo")?.path : previewPath(s.files);
    return preview
      ? [{ id: s.id, preview, createdAt: s.created_at, hidden: !!s.hidden_at, albumId: s.album_id, video: s.files.some((f) => f.kind === "video"), gif: s.files.some((f) => f.kind === "gif" || f.kind === "boomerang" || f.kind === "boomerangVideo") }]
      : [];
  });
  const urls = await viewUrls(list.map((s) => s.preview));
  return list.flatMap(({ preview, ...s }) => (urls.get(preview) ? [{ ...s, photo: urls.get(preview)! }] : []));
}

export interface Album {
  id: string;
  name: string;
  count: number;
}

/** An event's albums in order, with how many visible sessions each holds. */
export async function eventAlbums(eventId: string, opts: { includeHidden?: boolean } = {}): Promise<Album[]> {
  const db = supabaseAdmin();
  const [{ data: albums }, { data: rows }] = await Promise.all([
    db.from("gallery_albums").select("id, name").eq("event_id", eventId).order("position").order("created_at"),
    (() => {
      let q = db.from("gallery_sessions").select("album_id").eq("event_id", eventId).not("album_id", "is", null).not("ready_at", "is", null);
      if (!opts.includeHidden) q = q.is("hidden_at", null);
      return q;
    })(),
  ]);
  const counts = new Map<string, number>();
  for (const r of rows ?? []) counts.set(r.album_id as string, (counts.get(r.album_id as string) ?? 0) + 1);
  return (albums ?? []).map((a) => ({ id: a.id, name: a.name, count: counts.get(a.id) ?? 0 }));
}
