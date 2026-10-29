import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { supabaseAdmin } from "./supabase/server";

/**
 * Per-IP limits for the public forms and the app's API (counter table + rate_limit_hit(), migration
 * 0008). IPs are hashed before they're stored. If the database can't be reached the request is
 * allowed: a hiccup must never lock customers out of their booths.
 */
export const LIMITS = {
  login: { limit: 10, windowSeconds: 600 },
  passwordReset: { limit: 5, windowSeconds: 3600 },
  contact: { limit: 5, windowSeconds: 3600 },
  appSignIn: { limit: 20, windowSeconds: 600 },
  appToken: { limit: 20, windowSeconds: 600 },
  appLicence: { limit: 120, windowSeconds: 3600 },
  appUploads: { limit: 600, windowSeconds: 3600 },
  appOther: { limit: 60, windowSeconds: 3600 },
} as const;
export type LimitName = keyof typeof LIMITS;

export function ipFrom(h: Headers): string {
  return (h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0] ?? "unknown").trim().slice(0, 64);
}

const hashed = (ip: string) => createHash("sha256").update(`dslrsnap-rl:${ip}`).digest("base64url").slice(0, 22);

/** True when this caller is over the named limit. Counts the attempt either way. */
export async function overLimit(name: LimitName, ip: string): Promise<boolean> {
  const { limit, windowSeconds } = LIMITS[name];
  const { data, error } = await supabaseAdmin().rpc("rate_limit_hit", { p_key: `${name}:${hashed(ip)}`, p_limit: limit, p_window_seconds: windowSeconds });
  if (error) {
    console.error(`rate limit ${name}:`, error.message);
    return false;
  }
  return data === false;
}

/** For server actions, which have no Request object. */
export async function overLimitHere(name: LimitName): Promise<boolean> {
  return overLimit(name, ipFrom(await headers()));
}

export const TOO_MANY = "Too many attempts. Wait a few minutes and try again.";

/** For the app's API: the JSON error it shows the operator. */
export const tooMany = () => Response.json({ error: "rate_limited", message: "Too many requests. Wait a few minutes and try again." }, { status: 429 });
