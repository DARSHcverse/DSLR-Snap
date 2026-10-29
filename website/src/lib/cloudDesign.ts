import "server-only";
import { randomUUID } from "node:crypto";
import { DEFAULT_DESIGN, type Design, parseDesign } from "./design";
import { uploadUrl, viewUrls } from "./storage";
import { supabaseAdmin } from "./supabase/server";

export interface ResolvedDesign {
  design: Design;
  /** Signed links for the design's images. */
  images: { banner?: string; logo?: string; background?: string };
}

/** The look an event shows: its own design, else the operator's default, else DSLR Snap's. */
export async function designForEvent(userId: string, eventDesign: unknown): Promise<ResolvedDesign> {
  let raw = eventDesign;
  if (!raw) {
    const { data } = await supabaseAdmin().from("customer_profiles").select("brand_design").eq("user_id", userId).maybeSingle();
    raw = data?.brand_design ?? null;
  }
  const design = raw ? parseDesign(raw, userId) : DEFAULT_DESIGN;
  const paths = (["banner", "logo", "background"] as const).flatMap((k) => (design[k] ? [design[k]!] : []));
  const urls = await viewUrls(paths);
  return {
    design,
    images: {
      banner: design.banner ? urls.get(design.banner) : undefined,
      logo: design.logo ? urls.get(design.logo) : undefined,
      background: design.background ? urls.get(design.background) : undefined,
    },
  };
}

export async function saveEventDesign(userId: string, eventId: string, design: Design, makeDefault: boolean): Promise<void> {
  const db = supabaseAdmin();
  const { error } = await db.from("gallery_events").update({ design }).eq("id", eventId).eq("user_id", userId);
  if (error) throw new Error(error.message);
  if (makeDefault) await db.from("customer_profiles").upsert({ user_id: userId, brand_design: design });
}

/** Back to the operator's default look (or DSLR Snap's). */
export async function resetEventDesign(userId: string, eventId: string): Promise<void> {
  await supabaseAdmin().from("gallery_events").update({ design: null }).eq("id", eventId).eq("user_id", userId);
}

const IMAGE_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
export const MAX_BRAND_BYTES = 8 * 1024 * 1024;

/** A one-time link for the browser to upload a brand image straight to storage. */
export async function brandImageUpload(userId: string, contentType: string, bytes: number): Promise<{ path: string; url: string; headers: Record<string, string> }> {
  const ext = IMAGE_TYPES[contentType];
  if (!ext) throw new Error("Use a JPG, PNG or WebP image.");
  if (!(bytes > 0 && bytes <= MAX_BRAND_BYTES)) throw new Error("Images can be up to 8 MB.");
  const path = `${userId}/brand/${randomUUID()}.${ext}`;
  return { path, ...(await uploadUrl(path, contentType)) };
}
