import { cleanDeviceName, deviceLimit, hashSecret, isMachineHash, isSignInCode, isVerifier, makeRefreshToken, pkceMatches } from "@/lib/appAuth";
import { fail, licenceFor, notConfigured, readJson } from "@/lib/appApi";
import { entitlementFor } from "@/lib/account";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * Step 2 of app sign-in: the app swaps the one-time code (from the dslrsnap:// link or typed in)
 * plus its PKCE verifier for a refresh token and a signed licence for this computer.
 */
export async function POST(request: Request) {
  const off = notConfigured();
  if (off) return off;
  const body = await readJson(request);
  const { code, verifier, machine } = body ?? {};
  if (!isSignInCode(code) || !isVerifier(verifier) || !isMachineHash(machine)) {
    return fail(400, "invalid_request", "That sign-in code isn't valid. Press Sign in again.");
  }

  const db = supabaseAdmin();
  // Mark used in the same statement that reads it, so a code works exactly once.
  const { data: row } = await db
    .from("app_sign_in_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("code_hash", hashSecret(code))
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .select("user_id, challenge")
    .maybeSingle();
  if (!row || !pkceMatches(verifier, row.challenge)) {
    return fail(400, "invalid_code", "That code has expired or was already used. Press Sign in again.");
  }

  const limit = deviceLimit(await entitlementFor(row.user_id));
  const refreshToken = makeRefreshToken();
  const { data: claim, error } = await db
    .rpc("claim_device", {
      p_user: row.user_id,
      p_machine: machine,
      p_name: cleanDeviceName(body?.name),
      p_token_hash: hashSecret(refreshToken),
      p_max: limit,
    })
    .single<{ ok: boolean; active_names: string[] | null }>();
  if (error || !claim) return fail(500, "server_error", "Couldn't sign in right now. Try again in a minute.");
  if (!claim.ok) {
    const names = (claim.active_names ?? []).join(" and ");
    return fail(
      409,
      "device_limit",
      `Your account is already in use on ${limit} computers (${names}). Remove one, or add a computer, at dslrsnap.com/account.`,
    );
  }

  return Response.json({ refreshToken, licence: await licenceFor(row.user_id, machine) });
}
