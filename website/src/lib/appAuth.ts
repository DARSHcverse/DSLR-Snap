import { createHash, createPrivateKey, randomBytes, randomInt, sign, timingSafeEqual } from "node:crypto";
import { MAX_DEVICES, OFFLINE_GRACE_DAYS, type PlanId } from "./plans";

// Pure rules for signing the desktop app in. Kept free of Next.js and database code so they're unit-tested.

const DAY = 86_400_000;
/** No 0/O, 1/I/L: the code may be read off a screen and typed. */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CODE_TTL_MS = 10 * 60_000;

/** One-time sign-in code. Only useful together with the app's PKCE verifier, so 8 characters is plenty. */
export function makeSignInCode(): string {
  let s = "";
  for (let i = 0; i < 8; i++) s += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return s;
}

export function makeRefreshToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Codes and tokens are stored hashed, so a database leak can't be used to sign in. */
export function hashSecret(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

/** PKCE S256: the app proves it is the same app that started the sign-in. */
export function pkceMatches(verifier: string, challenge: string): boolean {
  const a = Buffer.from(createHash("sha256").update(verifier).digest("base64url"));
  const b = Buffer.from(challenge);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const isChallenge = (s: unknown): s is string => typeof s === "string" && /^[A-Za-z0-9_-]{43}$/.test(s);
export const isState = (s: unknown): s is string => typeof s === "string" && /^[A-Za-z0-9_-]{16,64}$/.test(s);
export const isVerifier = (s: unknown): s is string => typeof s === "string" && /^[A-Za-z0-9_-]{43,128}$/.test(s);
export const isMachineHash = (s: unknown): s is string => typeof s === "string" && /^[0-9a-f]{64}$/.test(s);
export const isSignInCode = (s: unknown): s is string => typeof s === "string" && new RegExp(`^[${CODE_ALPHABET}]{8}$`).test(s);

/** Computer names come from the app; keep them printable and short. */
export function cleanDeviceName(s: unknown): string {
  const name =
    typeof s === "string"
      ? s
          .replace(/[^\p{L}\p{N} ._'-]/gu, "")
          .replace(/\.(local|localdomain|lan|home|internal)$/i, "") // the network suffix macOS and routers add
          .trim()
          .slice(0, 64)
      : "";
  return name || "Booth computer";
}

/** Only same-site paths, so a crafted link can't bounce a signed-in user to another site. */
export function safeNext(next: unknown, fallback = "/account"): string {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : fallback;
}

export interface SubscriptionRow {
  status: string;
  plan: PlanId | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  extra_devices?: number;
}

export interface Entitlement {
  active: boolean;
  plan: PlanId | null;
  periodEnd: number | null;
  cancelAtPeriodEnd: boolean;
  /** Extra booth computers paid for on this subscription. */
  extraDevices: number;
  /** Free access given from the admin (no Stripe subscription). */
  complimentary?: boolean;
}

/** Free access set in the admin: forever (until null) or until a date, with its own computer allowance. */
export interface Complimentary {
  active: boolean;
  until: string | null;
  devices: number;
}

/**
 * A paid plan wins; otherwise free access, if it's on and not past its date, counts exactly like a
 * paid plan (no watermark, its own number of computers). An end date behaves like a cancelled plan,
 * so offline licences never outlast it.
 */
export function withComplimentary(paid: Entitlement, comp: Complimentary | null, now: number): Entitlement {
  if (paid.active) return { ...paid, complimentary: false };
  const until = comp?.until ? Date.parse(comp.until) : null;
  if (!comp?.active || (until !== null && until <= now)) return { ...paid, complimentary: false };
  return { active: true, plan: null, periodEnd: until, cancelAtPeriodEnd: until !== null, extraDevices: Math.max(0, comp.devices - MAX_DEVICES), complimentary: true };
}

/** Stripe keeps retrying a failed card (past_due) for a while; the customer keeps access meanwhile. */
const PAID_STATUSES = new Set(["active", "trialing", "past_due"]);

export function entitlementFrom(rows: SubscriptionRow[], now: number): Entitlement {
  const paid = rows
    .filter((r) => PAID_STATUSES.has(r.status) && r.current_period_end && Date.parse(r.current_period_end) > now - 3 * DAY)
    .sort((a, b) => Date.parse(b.current_period_end!) - Date.parse(a.current_period_end!));
  const best = paid[0];
  if (!best) return { active: false, plan: null, periodEnd: null, cancelAtPeriodEnd: false, extraDevices: 0 };
  return {
    active: true,
    plan: best.plan,
    periodEnd: Date.parse(best.current_period_end!),
    cancelAtPeriodEnd: best.cancel_at_period_end,
    extraDevices: Math.max(0, best.extra_devices ?? 0),
  };
}

/** Booth computers this account may sign in: the included ones, plus extras while the plan is paid. */
export function deviceLimit(e: Entitlement): number {
  return MAX_DEVICES + (e.active ? e.extraDevices : 0);
}

export interface LicencePayload {
  v: 1;
  sub: string;
  email: string;
  dev: string;
  plan: PlanId | null;
  active: boolean;
  iat: number;
  exp: number;
}

/**
 * The offline grace, but never past a cancelled plan's end (+3 days' slack), so cancelling
 * can't buy two weeks of offline use.
 */
export function licenceExpiry(e: Entitlement, now: number): number {
  const grace = now + OFFLINE_GRACE_DAYS * DAY;
  return e.active && e.cancelAtPeriodEnd && e.periodEnd ? Math.min(grace, e.periodEnd + 3 * DAY) : grace;
}

/** base64url(json).base64url(Ed25519 signature): verified offline by the app with the public key. */
export function signLicence(
  input: { userId: string; email: string; machineHash: string; entitlement: Entitlement; now: number },
  privateKeyB64: string,
): string {
  const payload: LicencePayload = {
    v: 1,
    sub: input.userId,
    email: input.email,
    dev: input.machineHash,
    plan: input.entitlement.plan,
    active: input.entitlement.active,
    iat: input.now,
    exp: licenceExpiry(input.entitlement, input.now),
  };
  const key = createPrivateKey({ key: Buffer.from(privateKeyB64, "base64"), format: "der", type: "pkcs8" });
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(null, Buffer.from(body), key).toString("base64url")}`;
}
