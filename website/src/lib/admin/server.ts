import "server-only";
import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { supabaseAdmin } from "../supabase/server";
import { readSession, type SessionPayload, signSession } from "./crypto";

/**
 * Admin sign-in: one owner account from environment variables (website/scripts/generate-admin.mjs),
 * password + authenticator code, a signed cookie, rate-limited attempts and an activity log.
 */
const env = process.env;
export const adminConfig =
  env.ADMIN_PATH && env.ADMIN_USERNAME && env.ADMIN_PASSWORD_HASH && env.ADMIN_TOTP_SECRET && env.ADMIN_SESSION_SECRET
    ? {
        path: env.ADMIN_PATH.replace(/^\/+|\/+$/g, ""),
        username: env.ADMIN_USERNAME,
        passwordHash: env.ADMIN_PASSWORD_HASH,
        totpSecret: env.ADMIN_TOTP_SECRET,
        // Changing the password also signs out every admin session.
        sessionKey: `${env.ADMIN_SESSION_SECRET}:${env.ADMIN_PASSWORD_HASH}`,
      }
    : null;

const COOKIE = "dsnap_admin";
const SESSION_MS = 12 * 3_600_000;
const PENDING_MS = 5 * 60_000;

/** A link inside the admin, at its private address. */
export function adminHref(sub = ""): string {
  if (!adminConfig) return "/";
  return `/${adminConfig.path}${sub ? `/${sub.replace(/^\/+/, "")}` : ""}`;
}

async function readCookie(): Promise<SessionPayload | null> {
  if (!adminConfig) return null;
  return readSession((await cookies()).get(COOKIE)?.value, adminConfig.sessionKey);
}

export async function setAdminCookie(kind: SessionPayload["kind"]): Promise<void> {
  if (!adminConfig) return;
  const exp = Date.now() + (kind === "session" ? SESSION_MS : PENDING_MS);
  (await cookies()).set(COOKIE, signSession({ kind, user: adminConfig.username, exp }, adminConfig.sessionKey), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    expires: new Date(exp),
  });
}

export async function clearAdminCookie(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

/** Password accepted, waiting for the authenticator code. */
export async function hasPendingLogin(): Promise<boolean> {
  return (await readCookie())?.kind === "pending";
}

/** Every admin page and action calls this first. Not configured → the admin doesn't exist (404). */
export async function requireAdmin(): Promise<string> {
  if (!adminConfig) notFound();
  const s = await readCookie();
  if (s?.kind !== "session") redirect(adminHref("login"));
  return s.user;
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0] ?? "unknown").trim().slice(0, 64);
}

/** 5 failed attempts from one address, or 30 from anywhere, in 15 minutes locks sign-in for a while. */
export async function loginBlocked(ip: string): Promise<boolean> {
  const since = new Date(Date.now() - 15 * 60_000).toISOString();
  const db = supabaseAdmin();
  const [mine, all] = await Promise.all([
    db.from("admin_login_attempts").select("id", { count: "exact", head: true }).eq("ip", ip).eq("ok", false).gt("at", since),
    db.from("admin_login_attempts").select("id", { count: "exact", head: true }).eq("ok", false).gt("at", since),
  ]);
  return (mine.count ?? 0) >= 5 || (all.count ?? 0) >= 30;
}

export async function recordLoginAttempt(ip: string, ok: boolean): Promise<void> {
  await supabaseAdmin().from("admin_login_attempts").insert({ ip, ok });
}

/** Writes one line to the activity log. */
export async function audit(action: string, target: { userId?: string; email?: string | null } = {}, detail: Record<string, unknown> = {}): Promise<void> {
  await supabaseAdmin()
    .from("admin_audit")
    .insert({ action, user_id: target.userId ?? null, user_email: target.email ?? null, detail, ip: await clientIp() });
}
