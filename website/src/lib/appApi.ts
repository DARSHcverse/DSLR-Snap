import "server-only";
import { entitlementFor } from "./account";
import { signLicence } from "./appAuth";
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
