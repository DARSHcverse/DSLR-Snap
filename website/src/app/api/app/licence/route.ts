import { isMachineHash } from "@/lib/appAuth";
import { deviceFromRequest, fail, licenceFor, notConfigured, readJson, signedOut } from "@/lib/appApi";
import { supabaseAdmin } from "@/lib/supabase/server";

/** The app asks for a fresh licence when it starts and every few hours while online. */
export async function POST(request: Request) {
  const off = notConfigured();
  if (off) return off;
  const body = await readJson(request);
  if (typeof body?.refreshToken !== "string" || !isMachineHash(body?.machine)) return fail(400, "invalid_request", "Bad request.");
  // A token copied to another computer doesn't match that computer's id.
  const device = await deviceFromRequest(body);
  if (!device) return signedOut();
  await supabaseAdmin().from("devices").update({ last_seen_at: new Date().toISOString() }).eq("id", device.id);
  return Response.json({ licence: await licenceFor(device.userId, body.machine as string) });
}
