"use server";

import { CODE_TTL_MS, hashSecret, isChallenge, isState, makeSignInCode } from "@/lib/appAuth";
import { appSignInEnabled } from "@/lib/config";
import { overLimitHere, TOO_MANY } from "@/lib/rateLimit";
import { getCurrentUser, supabaseAdmin } from "@/lib/supabase/server";

export type ApproveResult = { code: string; link: string } | { error: string } | null;

/** Issues a one-time code bound to the app's PKCE challenge. Useless to anyone without the app's verifier. */
export async function approveAppSignIn(_prev: ApproveResult, form: FormData): Promise<ApproveResult> {
  if (!appSignInEnabled) return { error: "Sign-in isn't switched on yet." };
  const user = await getCurrentUser();
  if (!user) return { error: "Your session ended. Reload this page and sign in." };
  if (await overLimitHere("appSignIn")) return { error: TOO_MANY };
  const challenge = form.get("challenge");
  const state = form.get("state");
  if (!isChallenge(challenge) || !isState(state)) return { error: "This link is incomplete. Press Sign in in the app again." };

  const code = makeSignInCode();
  const { error } = await supabaseAdmin()
    .from("app_sign_in_codes")
    .insert({ code_hash: hashSecret(code), user_id: user.id, challenge, expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString() });
  if (error) return { error: "Couldn't create a sign-in code. Try again." };
  return { code, link: `dslrsnap://auth?${new URLSearchParams({ code, state })}` };
}
