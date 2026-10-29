import { after } from "next/server";
import { describeFiles, type GalleryFile, isExpired, isUuid } from "@/lib/gallery";
import { recordHit, visitor } from "@/lib/galleryStats";
import { viewUrls } from "@/lib/storage";
import { supabaseAdmin } from "@/lib/supabase/server";

/** A guest's Download button: counts the download for the operator, then hands over the file. */
export async function GET(_request: Request, { params }: RouteContext<"/s/[id]/get/[kind]">) {
  const { id, kind } = await params;
  if (!isUuid(id)) return new Response("Not found", { status: 404 });
  const { data } = await supabaseAdmin().from("gallery_sessions").select("files, event_id, ready_at, created_at").eq("id", id).maybeSingle();
  if (!data?.ready_at || isExpired(data.created_at, Date.now())) return new Response("Not found", { status: 404 });
  const files = data.files as GalleryFile[];
  const offered = describeFiles(files).find((d) => d.kind === kind); // only what the page offers (never thumbnails)
  const path = offered && files.find((f) => f.kind === offered.kind)?.path;
  if (!offered || !path) return new Response("Not found", { status: 404 });
  const url = (await viewUrls([path], () => offered.filename)).get(path);
  if (!url) return new Response("Not available", { status: 503 });
  const who = await visitor();
  after(() => recordHit(data.event_id, "download", who));
  return Response.redirect(url, 302);
}
