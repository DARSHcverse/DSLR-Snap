import { deviceFromRequest, fail, notConfigured, readJson, signedOut } from "@/lib/appApi";
import { cleanPresets } from "@/lib/appSettings";
import { ipFrom, overLimit, tooMany } from "@/lib/rateLimit";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * A booth's synced settings ("My settings" camera presets). With `cameraPresets` the booth saves
 * its list (the whole list, newest wins); either way the account's current list comes back.
 */
export async function POST(request: Request) {
  if (await overLimit("appSettings", ipFrom(request.headers))) return tooMany();
  const off = notConfigured();
  if (off) return off;
  const body = await readJson(request);
  const device = await deviceFromRequest(body);
  if (!device) return signedOut();
  const db = supabaseAdmin();

  if (body && "cameraPresets" in body) {
    const presets = cleanPresets(body.cameraPresets);
    if (!presets) return fail(400, "invalid_request", "Bad request.");
    const { error } = await db
      .from("app_settings")
      .upsert({ user_id: device.userId, camera_presets: presets, camera_presets_at: new Date().toISOString() });
    if (error) return fail(500, "server_error", "Couldn't save your settings. Try again.");
  }
  const { data } = await db.from("app_settings").select("camera_presets, camera_presets_at").eq("user_id", device.userId).maybeSingle();
  return Response.json({ cameraPresets: data?.camera_presets ?? [], updatedAt: data?.camera_presets_at ?? null });
}
