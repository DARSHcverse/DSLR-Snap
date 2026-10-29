import { ipFrom, overLimit, tooMany } from "@/lib/rateLimit";
import { deviceFromRequest, fail, notConfigured, readJson, signedOut } from "@/lib/appApi";
import { isUuid } from "@/lib/gallery";
import { supabaseAdmin } from "@/lib/supabase/server";

/** Step 2: every file is up, so the guest page can show the photos. */
export async function POST(request: Request) {
  if (await overLimit("appUploads", ipFrom(request.headers))) return tooMany();
  const off = notConfigured();
  if (off) return off;
  const body = await readJson(request);
  const device = await deviceFromRequest(body);
  if (!device) return signedOut();
  if (!isUuid(body?.sessionId)) return fail(400, "invalid_request", "Bad session id.");
  const { data } = await supabaseAdmin()
    .from("gallery_sessions")
    .update({ ready_at: new Date().toISOString() })
    .eq("id", body.sessionId)
    .eq("user_id", device.userId)
    .select("id")
    .maybeSingle();
  if (!data) return fail(404, "not_found", "Upload not found. It will retry.");
  return Response.json({ ok: true });
}
