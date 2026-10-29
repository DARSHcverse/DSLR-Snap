import { ipFrom, overLimit, tooMany } from "@/lib/rateLimit";
import { hashSecret } from "@/lib/appAuth";
import { notConfigured, readJson } from "@/lib/appApi";
import { supabaseAdmin } from "@/lib/supabase/server";

/** Frees this computer's slot when the operator signs out in the app. */
export async function POST(request: Request) {
  if (await overLimit("appOther", ipFrom(request.headers))) return tooMany();
  const off = notConfigured();
  if (off) return off;
  const { refreshToken } = (await readJson(request)) ?? {};
  if (typeof refreshToken === "string" && refreshToken.length >= 20) {
    await supabaseAdmin()
      .from("devices")
      .update({ revoked_at: new Date().toISOString(), refresh_token_hash: null })
      .eq("refresh_token_hash", hashSecret(refreshToken));
  }
  return Response.json({ ok: true });
}
