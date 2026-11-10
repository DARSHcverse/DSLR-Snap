"use server";

import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { welcomeIfNew } from "@/lib/email/lifecycle";
import { overLimitHere, TOO_MANY } from "@/lib/rateLimit";
import { safeNext } from "@/lib/appAuth";
import { accountsEnabled, appUrl, supabaseConfig } from "@/lib/config";
import { supabaseForRequest } from "@/lib/supabase/server";

export type AuthResult = { error?: string; message?: string } | null;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Supabase keeps passwords as bcrypt hashes, which only use the first 72 bytes. */
const passwordProblem = (p: string) =>
  p.length < 8 ? "Use at least 8 characters for your password." : Buffer.byteLength(p) > 72 ? "Use at most 72 characters for your password." : null;
/** Setting a password without the current one needs a fresh sign-in (a reset link signs you in "now"). */
const RECENT_SIGN_IN_MS = 15 * 60_000;
const signedInRecently = (lastSignIn: string | undefined) => !!lastSignIn && Date.now() - Date.parse(lastSignIn) < RECENT_SIGN_IN_MS;
const callback = (next: string) => `${appUrl}/auth/callback?next=${encodeURIComponent(next)}`;

export async function passwordAuth(_prev: AuthResult, form: FormData): Promise<AuthResult> {
  if (!accountsEnabled) return { error: "Accounts aren't open yet." };
  const mode = form.get("mode") === "signup" ? "signup" : "login";
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const next = safeNext(form.get("next"));
  if (!EMAIL.test(email)) return { error: "Enter a valid email address." };
  if (await overLimitHere("login")) return { error: TOO_MANY };
  const weak = mode === "signup" ? passwordProblem(password) : null;
  if (weak) return { error: weak };

  const supabase = await supabaseForRequest();
  if (mode === "signup") {
    const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: callback(next) } });
    // Never say whether an address already has an account (that would let anyone find customers).
    if (error?.code === "user_already_exists" || error?.code === "email_exists") return { message: `We've emailed a link to ${email}. Open it to finish creating your account.` };
    if (error) return { error: error.code === "weak_password" ? "Choose a stronger password: it's too easy to guess." : error.message };
    if (!data.session) return { message: `We've emailed a link to ${email}. Open it to finish creating your account.` };
  } else {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (data.user) after(() => welcomeIfNew(data.user)); // accounts confirmed before welcome emails existed
    if (error) return { error: error.code === "email_not_confirmed" ? "Confirm your email first: check your inbox for our link." : "Wrong email or password." };
  }
  redirect(next);
}

export async function googleAuth(form: FormData): Promise<void> {
  if (!accountsEnabled) redirect("/login");
  const supabase = await supabaseForRequest();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callback(safeNext(form.get("next"))) },
  });
  redirect(error || !data.url ? "/login?error=google" : data.url);
}

export async function requestPasswordReset(_prev: AuthResult, form: FormData): Promise<AuthResult> {
  if (!accountsEnabled) return { error: "Accounts aren't open yet." };
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL.test(email)) return { error: "Enter a valid email address." };
  if (await overLimitHere("passwordReset")) return { error: TOO_MANY };
  const supabase = await supabaseForRequest();
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: callback("/reset?step=new") });
  // Same answer whether or not the account exists, so this can't be used to find customers.
  return { message: `If ${email} has an account, we've emailed a link to reset the password.` };
}

/**
 * The last step of "Forgot password": the emailed link has just signed the person in. Only a fresh
 * sign-in may set a password this way, so a browser someone left signed in can't be used to take
 * over the account. Every other device is signed out afterwards.
 */
export async function setNewPassword(_prev: AuthResult, form: FormData): Promise<AuthResult> {
  if (!accountsEnabled) return { error: "Accounts aren't open yet." };
  const password = String(form.get("password") ?? "");
  const weak = passwordProblem(password);
  if (weak) return { error: weak };
  const supabase = await supabaseForRequest();
  const { data } = await supabase.auth.getUser();
  if (!data.user || !signedInRecently(data.user.last_sign_in_at)) return { error: "That reset link has expired. Ask for a new one." };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.code === "same_password" ? "That's your current password. Choose a new one." : "Couldn't set the password. Ask for a new reset link." };
  await supabase.auth.signOut({ scope: "others" });
  redirect("/account");
}

/**
 * Settings → Password. With a password already, the current one is checked first (without touching
 * this browser's sign-in). Google-only accounts adding a password need a fresh sign-in instead.
 */
export async function changePassword(_prev: AuthResult, form: FormData): Promise<AuthResult> {
  if (!accountsEnabled || !supabaseConfig) return { error: "Accounts aren't open yet." };
  const current = String(form.get("current") ?? "");
  const password = String(form.get("password") ?? "");
  const weak = passwordProblem(password);
  if (weak) return { error: weak };
  const supabase = await supabaseForRequest();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user?.email) return { error: "Sign in again, then try once more." };
  const hasPassword = (user.identities ?? []).some((i) => i.provider === "email");
  if (hasPassword) {
    if (await overLimitHere("login")) return { error: TOO_MANY };
    const check = createClient(supabaseConfig.url, supabaseConfig.publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await check.auth.signInWithPassword({ email: user.email, password: current });
    if (error) return { error: "Your current password is wrong." };
    await check.auth.signOut({ scope: "local" }).catch(() => undefined); // drop the check's own session
  } else if (!signedInRecently(user.last_sign_in_at)) {
    return { error: "For your security, sign out and sign in again with Google, then set your password." };
  }
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.code === "same_password" ? "That's your current password. Choose a new one." : "Couldn't change the password. Try again." };
  await supabase.auth.signOut({ scope: "others" });
  return { message: "Password changed. Any other computers or phones signed in to your account have been signed out." };
}

export async function signOut(): Promise<void> {
  if (accountsEnabled) await (await supabaseForRequest()).auth.signOut();
  redirect("/");
}
