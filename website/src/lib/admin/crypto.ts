import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * The admin login's building blocks, kept pure so they can be tested: password hashes (scrypt),
 * authenticator codes (TOTP, RFC 6238, as Google Authenticator uses) and signed session cookies.
 */

// ---------- Passwords: "scrypt:<N>:<salt b64>:<hash b64>" ----------
// ":" not "$": .env files expand "$name", which would corrupt a "$"-separated hash.

const N = 1 << 15;
const KEYLEN = 32;
const scryptOpts = (n: number) => ({ N: n, r: 8, p: 1, maxmem: 128 * n * 8 * 2 });

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEYLEN, scryptOpts(N));
  return `scrypt:${N}:${salt.toString("base64")}:${hash.toString("base64")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, n, salt, hash] = stored.split(":");
  if (scheme !== "scrypt" || !n || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const actual = scryptSync(password, Buffer.from(salt, "base64"), expected.length, scryptOpts(Number(n)));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Constant-time string comparison (for the username). */
export function sameText(a: string, b: string): boolean {
  const x = createHmac("sha256", "cmp").update(a).digest();
  const y = createHmac("sha256", "cmp").update(b).digest();
  return timingSafeEqual(x, y);
}

// ---------- Authenticator codes (TOTP) ----------

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer): string {
  let bits = 0, value = 0, out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string): Buffer {
  const clean = s.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    value = (value << 5) | B32.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** The 6-digit code for a 30-second step (RFC 6238 with HMAC-SHA1, like Google Authenticator). */
export function totp(secret: Buffer, unixSeconds: number, digits = 6): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(unixSeconds / 30)));
  const mac = createHmac("sha1", secret).update(counter).digest();
  const offset = mac[mac.length - 1] & 15;
  const code = (mac.readUInt32BE(offset) & 0x7fffffff) % 10 ** digits;
  return String(code).padStart(digits, "0");
}

/** Accepts the current code or one step either side (phone clocks drift). */
export function verifyTotp(base32Secret: string, code: string, unixSeconds = Math.floor(Date.now() / 1000)): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  const secret = base32Decode(base32Secret);
  if (!secret.length) return false;
  return [-30, 0, 30].some((d) => sameText(totp(secret, unixSeconds + d), code));
}

// ---------- Signed cookies: "<payload b64url>.<hmac b64url>" ----------

export interface SessionPayload {
  /** "session" = signed in; "pending" = password accepted, authenticator code still needed. */
  kind: "session" | "pending";
  user: string;
  exp: number; // ms
}

export function signSession(p: SessionPayload, key: string): string {
  const body = Buffer.from(JSON.stringify(p)).toString("base64url");
  return `${body}.${createHmac("sha256", key).update(body).digest("base64url")}`;
}

export function readSession(token: string | undefined, key: string, now = Date.now()): SessionPayload | null {
  if (!token || !key) return null;
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const expected = createHmac("sha256", key).update(body).digest();
  const given = Buffer.from(mac, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString()) as SessionPayload;
    return p.exp > now && (p.kind === "session" || p.kind === "pending") ? p : null;
  } catch {
    return null;
  }
}
