import { timingSafeEqual } from "node:crypto";
import { accountsEnabled } from "@/lib/config";
import { GALLERY_BUCKET, type GalleryFile, RETENTION_DAYS } from "@/lib/gallery";
import { supabaseAdmin } from "@/lib/supabase/server";

const BATCH = 200;

/**
 * Daily (vercel.json): deletes gallery sessions older than the retention period, files first.
 * Vercel sends "Authorization: Bearer $CRON_SECRET"; anything else is refused.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (!secret || given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!accountsEnabled) return Response.json({ deleted: 0 });

  const db = supabaseAdmin();
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000).toISOString();
  const { data: old } = await db.from("gallery_sessions").select("id, files").lt("created_at", cutoff).limit(BATCH);
  const rows = (old ?? []) as { id: string; files: GalleryFile[] }[];
  if (!rows.length) return Response.json({ deleted: 0 });

  const paths = rows.flatMap((r) => r.files.map((f) => f.path));
  const { error } = await db.storage.from(GALLERY_BUCKET).remove(paths);
  if (error) return Response.json({ error: error.message }, { status: 500 }); // rows stay; retried tomorrow
  await db.from("gallery_sessions").delete().in("id", rows.map((r) => r.id));
  return Response.json({ deleted: rows.length, more: rows.length === BATCH });
}
