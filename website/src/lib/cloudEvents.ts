import "server-only";
import { hashPassword } from "./admin/crypto";
import { type GalleryFile, makeShareToken, RETENTION_DAYS } from "./gallery";
import { eventSessions, previewPath } from "./galleryServer";
import { removeFiles, viewUrls } from "./storage";
import { supabaseAdmin } from "./supabase/server";

/**
 * DSLR Snap Cloud for the operator: their events, each event's sessions and settings. Every
 * function takes the signed-in operator's id and only ever touches their own rows.
 */

export interface CloudEventCard {
  id: string;
  name: string;
  date: string | null;
  sessions: number;
  hidden: number;
  cover: string | null;
  lastActivity: string | null;
  /** When the oldest photos reach the one-year limit and start being removed. */
  firstExpiry: string | null;
  linkEnabled: boolean;
  passwordSet: boolean;
}

export async function listEvents(userId: string): Promise<CloudEventCard[]> {
  const db = supabaseAdmin();
  const since = new Date(Date.now() - RETENTION_DAYS * 86_400_000).toISOString();
  const [{ data: events }, { data: sessions }] = await Promise.all([
    db.from("gallery_events").select("id, name, event_date, cover_session_id, link_enabled, password_hash, created_at").eq("user_id", userId),
    db.from("gallery_sessions").select("id, event_id, files, created_at, hidden_at").eq("user_id", userId).not("ready_at", "is", null).gt("created_at", since),
  ]);
  type Row = { id: string; event_id: string; files: GalleryFile[]; created_at: string; hidden_at: string | null };
  const byEvent = new Map<string, Row[]>();
  for (const s of (sessions ?? []) as Row[]) byEvent.set(s.event_id, [...(byEvent.get(s.event_id) ?? []), s]);

  const cards = (events ?? []).map((e) => {
    const rows = (byEvent.get(e.id) ?? []).sort((a, b) => b.created_at.localeCompare(a.created_at));
    const visible = rows.filter((r) => !r.hidden_at);
    const coverRow = rows.find((r) => r.id === e.cover_session_id) ?? visible[0] ?? rows[0];
    const oldest = rows.at(-1)?.created_at;
    return {
      card: {
        id: e.id,
        name: e.name,
        date: e.event_date,
        sessions: visible.length,
        hidden: rows.length - visible.length,
        cover: null as string | null,
        lastActivity: rows[0]?.created_at ?? null,
        firstExpiry: oldest ? new Date(Date.parse(oldest) + RETENTION_DAYS * 86_400_000).toISOString() : null,
        linkEnabled: e.link_enabled,
        passwordSet: !!e.password_hash,
      },
      coverPath: coverRow ? previewPath(coverRow.files) : undefined,
      sortKey: e.event_date ?? rows[0]?.created_at ?? e.created_at,
    };
  });
  const urls = await viewUrls(cards.flatMap((c) => (c.coverPath ? [c.coverPath] : [])));
  // Newest event first (by its date, else its latest photo).
  return cards
    .sort((a, b) => String(b.sortKey).localeCompare(String(a.sortKey)))
    .map((c) => ({ ...c.card, cover: c.coverPath ? (urls.get(c.coverPath) ?? null) : null }));
}

export interface CloudEvent {
  id: string;
  name: string;
  date: string | null;
  shareToken: string;
  linkEnabled: boolean;
  passwordSet: boolean;
  guestAccess: "own" | "all";
  allowDownloadAll: boolean;
  showDate: boolean;
  website: string | null;
  coverSessionId: string | null;
}

export async function getEvent(userId: string, id: string): Promise<CloudEvent | null> {
  const { data: e } = await supabaseAdmin()
    .from("gallery_events")
    .select("id, name, event_date, share_token, link_enabled, password_hash, guest_access, allow_download_all, show_date, website_url, cover_session_id")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!e) return null;
  return {
    id: e.id,
    name: e.name,
    date: e.event_date,
    shareToken: e.share_token,
    linkEnabled: e.link_enabled,
    passwordSet: !!e.password_hash,
    guestAccess: e.guest_access === "all" ? "all" : "own",
    allowDownloadAll: e.allow_download_all,
    showDate: e.show_date,
    website: e.website_url,
    coverSessionId: e.cover_session_id,
  };
}

/** Every session for the operator's grid, hidden ones included (marked). */
export const sessionsForOwner = (eventId: string) => eventSessions(eventId, { includeHidden: true });

export interface EventSettings {
  name: string;
  date: string | null;
  showDate: boolean;
  linkEnabled: boolean;
  guestAccess: "own" | "all";
  allowDownloadAll: boolean;
  website: string | null;
  /** undefined = keep, "" = remove, text = set. */
  password?: string;
}

export async function saveSettings(userId: string, id: string, s: EventSettings): Promise<void> {
  const update: Record<string, unknown> = {
    name: s.name.trim().slice(0, 120) || "Event",
    event_date: s.date,
    show_date: s.showDate,
    link_enabled: s.linkEnabled,
    guest_access: s.guestAccess,
    allow_download_all: s.allowDownloadAll,
    website_url: s.website,
    edited_at: new Date().toISOString(),
  };
  if (s.password !== undefined) update.password_hash = s.password ? hashPassword(s.password) : null;
  const { error } = await supabaseAdmin().from("gallery_events").update(update).eq("id", id).eq("user_id", userId);
  if (error) throw new Error(error.message);
}

/** A new host link; the old one stops working at once. */
export async function newShareLink(userId: string, id: string): Promise<void> {
  await supabaseAdmin().from("gallery_events").update({ share_token: makeShareToken() }).eq("id", id).eq("user_id", userId);
}

export async function setCover(userId: string, eventId: string, sessionId: string): Promise<void> {
  await supabaseAdmin().from("gallery_events").update({ cover_session_id: sessionId }).eq("id", eventId).eq("user_id", userId);
}

/** Hide or show sessions in the event gallery (the guest's own QR link keeps working either way). */
export async function setHidden(userId: string, eventId: string, sessionIds: string[], hidden: boolean): Promise<void> {
  if (!sessionIds.length) return;
  await supabaseAdmin()
    .from("gallery_sessions")
    .update({ hidden_at: hidden ? new Date().toISOString() : null })
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .in("id", sessionIds);
}

/** Deletes sessions for good: files first, then rows (so a failure never leaves orphaned files unlisted). */
export async function deleteSessions(userId: string, eventId: string, sessionIds?: string[]): Promise<number> {
  const db = supabaseAdmin();
  let q = db.from("gallery_sessions").select("id, files").eq("event_id", eventId).eq("user_id", userId);
  if (sessionIds) q = q.in("id", sessionIds);
  const { data } = await q;
  const rows = (data ?? []) as { id: string; files: GalleryFile[] }[];
  if (!rows.length) return 0;
  await removeFiles(rows.flatMap((r) => r.files.map((f) => f.path)));
  await db.from("gallery_sessions").delete().eq("user_id", userId).in("id", rows.map((r) => r.id));
  return rows.length;
}

/** The whole event's cloud gallery: every file, then the event. The booth computer's copies are untouched. */
export async function deleteEvent(userId: string, eventId: string): Promise<void> {
  if (!(await getEvent(userId, eventId))) return;
  await deleteSessions(userId, eventId);
  await supabaseAdmin().from("gallery_events").delete().eq("id", eventId).eq("user_id", userId);
}
