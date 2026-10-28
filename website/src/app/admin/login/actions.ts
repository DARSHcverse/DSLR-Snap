"use server";

import { redirect } from "next/navigation";
import { sameText, verifyPassword, verifyTotp } from "@/lib/admin/crypto";
import {
  adminConfig,
  adminHref,
  audit,
  clearAdminCookie,
  clientIp,
  hasPendingLogin,
  loginBlocked,
  recordLoginAttempt,
  setAdminCookie,
} from "@/lib/admin/server";

export type LoginResult = { error: string } | null;

const LOCKED = "Too many attempts. Wait 15 minutes, then try again.";
const WRONG = "That didn't match. Check and try again.";

/** Step 1: username and password. The same answer whichever part was wrong. */
export async function loginPassword(_prev: LoginResult, form: FormData): Promise<LoginResult> {
  if (!adminConfig) return { error: WRONG };
  const ip = await clientIp();
  if (await loginBlocked(ip)) return { error: LOCKED };
  const user = String(form.get("username") ?? "");
  const password = String(form.get("password") ?? "");
  const userOk = sameText(user, adminConfig.username);
  const passOk = verifyPassword(password, adminConfig.passwordHash); // always run: same timing either way
  if (!userOk || !passOk) {
    await recordLoginAttempt(ip, false);
    return { error: WRONG };
  }
  await setAdminCookie("pending");
  redirect(adminHref("login"));
}

/** Step 2: the 6-digit code from the authenticator app. */
export async function loginCode(_prev: LoginResult, form: FormData): Promise<LoginResult> {
  if (!adminConfig || !(await hasPendingLogin())) redirect(adminHref("login"));
  const ip = await clientIp();
  if (await loginBlocked(ip)) return { error: LOCKED };
  const code = String(form.get("code") ?? "").replace(/\s/g, "");
  if (!verifyTotp(adminConfig.totpSecret, code)) {
    await recordLoginAttempt(ip, false);
    return { error: "That code didn't work. Codes change every 30 seconds; use the newest one." };
  }
  await recordLoginAttempt(ip, true);
  await setAdminCookie("session");
  await audit("admin.sign_in");
  redirect(adminHref());
}

export async function logout(): Promise<void> {
  await clearAdminCookie();
  redirect(adminHref("login"));
}

export async function restartLogin(): Promise<void> {
  await clearAdminCookie();
  redirect(adminHref("login"));
}
