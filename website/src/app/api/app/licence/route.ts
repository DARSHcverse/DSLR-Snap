import { hashSecret, isMachineHash } from "@/lib/appAuth";
import { fail, licenceFor, notConfigured, readJson } from "@/lib/appApi";
import { supabaseAdmin } from "@/lib/supabase/server";

/** The app asks for a fresh licence when it starts and every few hours while online. */
export async function POST(request: Request) {
  const off = notConfigured();
  if (off) return off;
  const body = await readJson(request);
  const { refreshToken, machine } = body ?? {};
  if (typeof refreshToken !== "string" || refreshToken.length < 20 || !isMachineHash(machine)) {
    return fail(400, "invalid_request", "Bad request.");
  }

  const db = supabaseAdmin();
  const { data: device } = await db
    .from("devices")
    .select("id, user_id, machine_hash")
    .eq("refresh_token_hash", hashSecret(refreshToken))
    .is("revoked_at", null)
    .maybeSingle();
  // A token copied to another computer doesn't match that computer's id.
  if (!device || device.machine_hash !== machine) {
    return fail(401, "signed_out", "This computer was signed out. Sign in again.");
  }
  await db.from("devices").update({ last_seen_at: new Date().toISOString() }).eq("id", device.id);
  return Response.json({ licence: await licenceFor(device.user_id, machine) });
}
