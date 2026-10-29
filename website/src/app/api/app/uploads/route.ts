import { ipFrom, overLimit, tooMany } from "@/lib/rateLimit";
import { entitlementFor } from "@/lib/account";
import { deviceFromRequest, fail, notConfigured, readJson, signedOut } from "@/lib/appApi";
import { appUrl } from "@/lib/config";
import { type GalleryFile, parseUploadRequest, storagePath } from "@/lib/gallery";
import { uploadUrl } from "@/lib/storage";
import { galleryEventFor } from "@/lib/galleryServer";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * Step 1 of a session upload: a paid, signed-in booth gets one-time upload links for the session's
 * files. The booth never holds a storage key, and nothing is accepted without an active plan.
 */
export async function POST(request: Request) {
  if (await overLimit("appUploads", ipFrom(request.headers))) return tooMany();
  const off = notConfigured();
  if (off) return off;
  const body = await readJson(request);
  const device = await deviceFromRequest(body);
  if (!device) return signedOut();
  if (!(await entitlementFor(device.userId)).active) {
    return fail(402, "subscription_required", "QR downloads need an active plan. Choose one at dslrsnap.com/account.");
  }
  const req = parseUploadRequest(body);
  if ("error" in req) return fail(400, "invalid_request", req.error);

  const db = supabaseAdmin();
  const { data: existing } = await db.from("gallery_sessions").select("user_id").eq("id", req.sessionId).maybeSingle();
  if (existing && existing.user_id !== device.userId) return fail(409, "conflict", "Session belongs to another account.");

  const event = await galleryEventFor(device.userId, req.event);
  const files: GalleryFile[] = req.files.map((f) => ({ kind: f.kind, contentType: f.contentType, path: storagePath(device.userId, event.id, req.sessionId, f.kind) }));
  const { error } = await db
    .from("gallery_sessions")
    .upsert({ id: req.sessionId, user_id: device.userId, event_id: event.id, files, ready_at: null });
  if (error) return fail(500, "server_error", "Couldn't start the upload. It will retry.");

  const uploads = [];
  for (const f of files) {
    try {
      uploads.push({ kind: f.kind, ...(await uploadUrl(f.path, f.contentType)) });
    } catch {
      return fail(500, "server_error", "Couldn't start the upload. It will retry.");
    }
  }
  return Response.json({ uploads, pageUrl: `${appUrl}/s/${req.sessionId}` });
}
