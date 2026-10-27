import { createHash, generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
// The app's own verifier: proves the website issues licences the app accepts.
import { verifyLicence } from "../../../src/main/licence/licence";
import {
  cleanDeviceName,
  deviceLimit,
  entitlementFrom,
  isSignInCode,
  licenceExpiry,
  makeSignInCode,
  pkceMatches,
  safeNext,
  signLicence,
} from "./appAuth";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 9, 27);
const iso = (ms: number) => new Date(ms).toISOString();
const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const PRIV = privateKey.export({ format: "der", type: "pkcs8" }).toString("base64");
const PUB = publicKey.export({ format: "der", type: "spki" }).toString("base64");
const MACHINE = createHash("sha256").update("pc").digest("hex");

describe("entitlementFrom", () => {
  it("is active for a paid, current subscription", () => {
    const e = entitlementFrom([{ status: "active", plan: "yearly", current_period_end: iso(NOW + 30 * DAY), cancel_at_period_end: false }], NOW);
    expect(e).toMatchObject({ active: true, plan: "yearly" });
  });

  it("keeps access while Stripe retries a failed card", () => {
    expect(entitlementFrom([{ status: "past_due", plan: "monthly", current_period_end: iso(NOW + DAY), cancel_at_period_end: false }], NOW).active).toBe(true);
  });

  it("is inactive when cancelled, unpaid, or long expired", () => {
    for (const status of ["canceled", "unpaid", "incomplete", "incomplete_expired"]) {
      expect(entitlementFrom([{ status, plan: "monthly", current_period_end: iso(NOW + DAY), cancel_at_period_end: false }], NOW).active).toBe(false);
    }
    expect(entitlementFrom([{ status: "active", plan: "monthly", current_period_end: iso(NOW - 10 * DAY), cancel_at_period_end: false }], NOW).active).toBe(false);
    expect(entitlementFrom([], NOW).active).toBe(false);
  });

  it("picks the subscription that runs longest", () => {
    const e = entitlementFrom(
      [
        { status: "canceled", plan: "monthly", current_period_end: iso(NOW + 90 * DAY), cancel_at_period_end: false },
        { status: "active", plan: "monthly", current_period_end: iso(NOW + 5 * DAY), cancel_at_period_end: true },
        { status: "active", plan: "yearly", current_period_end: iso(NOW + 300 * DAY), cancel_at_period_end: false },
      ],
      NOW,
    );
    expect(e.plan).toBe("yearly");
  });
});

describe("deviceLimit", () => {
  const row = (extra: number, status = "active") => ({ status, plan: "yearly" as const, current_period_end: iso(NOW + 30 * DAY), cancel_at_period_end: false, extra_devices: extra });

  it("is 2 computers, plus any extra computers bought", () => {
    expect(deviceLimit(entitlementFrom([row(0)], NOW))).toBe(2);
    expect(deviceLimit(entitlementFrom([row(3)], NOW))).toBe(5);
  });

  it("drops back to 2 when the plan has ended (trial)", () => {
    expect(deviceLimit(entitlementFrom([row(3, "canceled")], NOW))).toBe(2);
    expect(deviceLimit(entitlementFrom([], NOW))).toBe(2);
  });
});

describe("licences", () => {
  const active = { active: true, plan: "yearly" as const, periodEnd: NOW + 200 * DAY, cancelAtPeriodEnd: false, extraDevices: 0 };

  it("are accepted by the app on the computer they were issued to", () => {
    const token = signLicence({ userId: "u1", email: "a@b.co", machineHash: MACHINE, entitlement: active, now: NOW }, PRIV);
    expect(verifyLicence(token, PUB, MACHINE)).toMatchObject({ sub: "u1", active: true, exp: NOW + 14 * DAY });
    expect(verifyLicence(token, PUB, "f".repeat(64))).toBeNull();
  });

  it("never outlast a cancelled plan by more than 3 days", () => {
    expect(licenceExpiry({ ...active, cancelAtPeriodEnd: true, periodEnd: NOW + 2 * DAY }, NOW)).toBe(NOW + 5 * DAY);
    expect(licenceExpiry({ ...active, cancelAtPeriodEnd: true, periodEnd: NOW + 60 * DAY }, NOW)).toBe(NOW + 14 * DAY);
  });
});

describe("sign-in helpers", () => {
  it("checks PKCE with the RFC 7636 example", () => {
    expect(pkceMatches("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk", "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM")).toBe(true);
    expect(pkceMatches("wrong-verifier-wrong-verifier-wrong-verifier", "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM")).toBe(false);
  });

  it("makes typeable codes", () => {
    for (let i = 0; i < 50; i++) expect(isSignInCode(makeSignInCode())).toBe(true);
    expect(isSignInCode("ABCD0O1I")).toBe(false);
  });

  it("only redirects within the site", () => {
    expect(safeNext("/app/sign-in?x=1")).toBe("/app/sign-in?x=1");
    for (const bad of ["https://evil.com", "//evil.com", "/\\evil.com", undefined, ""]) expect(safeNext(bad)).toBe("/account");
  });

  it("cleans computer names", () => {
    expect(cleanDeviceName("DESKTOP-7Q2<script>")).toBe("DESKTOP-7Q2script");
    expect(cleanDeviceName("")).toBe("Booth computer");
  });
});
