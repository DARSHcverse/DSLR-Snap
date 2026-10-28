import { describe, expect, it } from "vitest";
import { base32Decode, base32Encode, hashPassword, readSession, sameText, signSession, totp, verifyPassword, verifyTotp } from "./crypto";

describe("admin passwords", () => {
  it("accepts the right password and refuses anything else", () => {
    const h = hashPassword("correct horse battery");
    expect(h).toMatch(/^scrypt:32768:/);
    expect(h).not.toContain("$"); // safe in .env files
    expect(verifyPassword("correct horse battery", h)).toBe(true);
    expect(verifyPassword("correct horse batterY", h)).toBe(false);
    expect(verifyPassword("x", "not-a-hash")).toBe(false);
    expect(hashPassword("same")).not.toBe(hashPassword("same")); // salted
  });

  it("compares usernames exactly", () => {
    expect(sameText("owner", "owner")).toBe(true);
    expect(sameText("owner", "Owner")).toBe(false);
  });
});

describe("authenticator codes (RFC 6238 test vectors)", () => {
  // RFC 6238 appendix B, SHA-1 secret "12345678901234567890", 8 digits.
  const secret = Buffer.from("12345678901234567890");
  it.each([
    [59, "94287082"],
    [1111111109, "07081804"],
    [1234567890, "89005924"],
    [2000000000, "69279037"],
  ])("time %i → %s", (t, code) => expect(totp(secret, t, 8)).toBe(code));

  it("base32 round-trips, and codes from the previous/next 30 s are accepted", () => {
    const b32 = base32Encode(secret);
    expect(b32).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
    expect(base32Decode(b32).equals(secret)).toBe(true);
    const now = 1_800_000_000;
    expect(verifyTotp(b32, totp(secret, now), now)).toBe(true);
    expect(verifyTotp(b32, totp(secret, now - 30), now)).toBe(true);
    expect(verifyTotp(b32, totp(secret, now - 90), now)).toBe(false);
    expect(verifyTotp(b32, "12345", now)).toBe(false);
  });
});

describe("admin session cookies", () => {
  const key = "k".repeat(64);
  it("round-trips, and rejects tampering, the wrong key and expiry", () => {
    const now = 1_000_000;
    const t = signSession({ kind: "session", user: "owner", exp: now + 1000 }, key);
    expect(readSession(t, key, now)).toMatchObject({ kind: "session", user: "owner" });
    const [body, mac] = t.split(".");
    const forged = Buffer.from(JSON.stringify({ kind: "session", user: "owner", exp: now + 9e12 })).toString("base64url");
    expect(readSession(`${forged}.${mac}`, key, now)).toBeNull();
    expect(readSession(`${body}.${mac}`, "other", now)).toBeNull();
    expect(readSession(t, key, now + 2000)).toBeNull();
    expect(readSession(undefined, key, now)).toBeNull();
  });
});
