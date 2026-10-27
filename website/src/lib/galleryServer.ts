import "server-only";
import { describeFiles, GALLERY_BUCKET, type GalleryFile, type GalleryFileKind, isExpired, makeShareToken, RETENTION_DAYS } from "./gallery";
import { supabaseAdmin } from "./supabase/server";

/** The account's gallery record for a booth event, created on first use (with the host's share token). */
export async function galleryEventFor(
  userId: string,
  event: { id: string; name: string; date: string | null },
): Promise<{ id: string; share_token: string }> {
  const db = supabaseAdmin();
  const { data: existing } = await db
    .from("gallery_events")
    .select("id, share_token")
    .eq("user_id", userId)
    .eq("app_event_id", event.id)
    .maybeSingle();
  if (existing) {
    await db.from("gallery_events").update({ name: event.name, event_date: event.date }).eq("id", existing.id);
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

const LINK_SECONDS = 60 * 60;

export type SessionGallery =
  | { state: "waiting" }
  | { state: "expired" }
  | { state: "ready"; eventName: string | null; items: { kind: GalleryFileKind; label: string; view?: string; download?: string }[] };

/** A guest session's photos with short-lived view and download links. */
export async function loadSessionGallery(id: string): Promise<SessionGallery> {
  const db = supabaseAdmin();
  const { data } = await db
    .from("gallery_sessions")
    .select("files, ready_at, created_at, gallery_events(name)")
    .eq("id", id)
    .maybeSingle();
  // The QR appears before the upload finishes (even offline), so "not there yet" is normal.
  if (!data?.ready_at) return { state: "waiting" };
  if (isExpired(data.created_at, Date.now())) return { state: "expired" };

  const files = data.files as GalleryFile[];
  const bucket = db.storage.from(GALLERY_BUCKET);
  const items = await Promise.all(
    describeFiles(files).map(async (d) => {
      const path = files.find((f) => f.kind === d.kind)!.path;
      const [view, download] = await Promise.all([
        bucket.createSignedUrl(path, LINK_SECONDS),
        bucket.createSignedUrl(path, LINK_SECONDS, { download: d.filename }),
      ]);
      return { kind: d.kind, label: d.label, view: view.data?.signedUrl, download: download.data?.signedUrl };
    }),
  );
  const event = data.gallery_events as unknown as { name: string } | null;
  return { state: "ready", eventName: event?.name ?? null, items };
}

/** The host's event page: newest sessions first, each with a signed link to its photo. */
export async function loadEventGallery(
  token: string,
  limit = 500,
): Promise<{ name: string; date: string | null; sessions: { id: string; photo: string }[] } | null> {
  const db = supabaseAdmin();
  const { data: event } = await db.from("gallery_events").select("id, name, event_date").eq("share_token", token).maybeSingle();
  if (!event) return null;
  const { data: rows } = await db
    .from("gallery_sessions")
    .select("id, files")
    .eq("event_id", event.id)
    .not("ready_at", "is", null)
    .gt("created_at", new Date(Date.now() - RETENTION_DAYS * 86_400_000).toISOString())
    .order("created_at", { ascending: false })
    .limit(limit);
  const list = ((rows ?? []) as { id: string; files: GalleryFile[] }[])
    .map((s) => ({ id: s.id, path: s.files.find((f) => f.kind === "photo")?.path }))
    .filter((s): s is { id: string; path: string } => !!s.path);
  const { data: signed } = list.length
    ? await db.storage.from(GALLERY_BUCKET).createSignedUrls(list.map((s) => s.path), LINK_SECONDS)
    : { data: [] };
  const urlFor = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
  return {
    name: event.name,
    date: event.event_date,
    sessions: list.flatMap((s) => (urlFor.get(s.path) ? [{ id: s.id, photo: urlFor.get(s.path)! }] : [])),
  };
}
