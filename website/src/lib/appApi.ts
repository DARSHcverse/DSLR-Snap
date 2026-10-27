import "server-only";
import { entitlementFor } from "./account";
import { hashSecret, isMachineHash, signLicence } from "./appAuth";
import { appSignInEnabled, licencePrivateKey } from "./config";
import { supabaseAdmin } from "./supabase/server";

/** JSON error the app shows to the operator as-is (`message`), with a stable `error` code. */
export const fail = (status: number, error: string, message: string) => Response.json({ error, message }, { status });

export const notConfigured = () =>
  appSignInEnabled ? null : fail(503, "not_configured", "Sign-in isn't switched on yet. Try again later.");

export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export async function licenceFor(userId: string, machineHash: string): Promise<string> {
  const { data, error } = await supabaseAdmin().auth.admin.getUserById(userId);
  if (error || !data.user) throw new Error("Account not found");
  return signLicence(
    { userId, email: data.user.email ?? "", machineHash, entitlement: await entitlementFor(userId), now: Date.now() },
    licencePrivateKey,
  );
}

/** The signed-in booth computer behind a request, or null (unknown token, removed, or copied to another PC). */
export async function deviceFromRequest(body: Record<string, unknown> | null): Promise<{ id: string; userId: string } | null> {
  const { refreshToken, machine } = body ?? {};
  if (typeof refreshToken !== "string" || refreshToken.length < 20 || !isMachineHash(machine)) return null;
  const { data } = await supabaseAdmin()
    .from("devices")
    .select("id, user_id, machine_hash")
    .eq("refresh_token_hash", hashSecret(refreshToken))
    .is("revoked_at", null)
    .maybeSingle();
  return data && data.machine_hash === machine ? { id: data.id, userId: data.user_id } : null;
}

export const signedOut = () => fail(401, "signed_out", "This computer was signed out. Sign in again under Account.");
