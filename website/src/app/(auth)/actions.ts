"use server";

import { redirect } from "next/navigation";
import { safeNext } from "@/lib/appAuth";
import { accountsEnabled, appUrl } from "@/lib/config";
import { supabaseForRequest } from "@/lib/supabase/server";

export type AuthResult = { error?: string; message?: string } | null;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const callback = (next: string) => `${appUrl}/auth/callback?next=${encodeURIComponent(next)}`;

export async function passwordAuth(_prev: AuthResult, form: FormData): Promise<AuthResult> {
  if (!accountsEnabled) return { error: "Accounts aren't open yet." };
  const mode = form.get("mode") === "signup" ? "signup" : "login";
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const next = safeNext(form.get("next"));
  if (!EMAIL.test(email)) return { error: "Enter a valid email address." };
  if (mode === "signup" && password.length < 8) return { error: "Use at least 8 characters for your password." };

  const supabase = await supabaseForRequest();
  if (mode === "signup") {
    const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: callback(next) } });
    if (error) return { error: error.message };
    if (!data.session) return { message: `We've emailed a link to ${email}. Open it to finish creating your account.` };
  } else {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
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
  const supabase = await supabaseForRequest();
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: callback("/reset?step=new") });
  // Same answer whether or not the account exists, so this can't be used to find customers.
  return { message: `If ${email} has an account, we've emailed a link to reset the password.` };
}

export async function setNewPassword(_prev: AuthResult, form: FormData): Promise<AuthResult> {
  if (!accountsEnabled) return { error: "Accounts aren't open yet." };
  const password = String(form.get("password") ?? "");
  if (password.length < 8) return { error: "Use at least 8 characters for your password." };
  const supabase = await supabaseForRequest();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: "That reset link has expired. Ask for a new one." };
  redirect("/account");
}

export async function signOut(): Promise<void> {
  if (accountsEnabled) await (await supabaseForRequest()).auth.signOut();
  redirect("/");
}
