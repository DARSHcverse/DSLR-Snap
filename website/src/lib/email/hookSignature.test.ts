import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyStandardWebhook } from "./hookSignature";

const raw = Buffer.from("supabase-hook-test-secret-32bytes!!");
const secret = `v1,whsec_${raw.toString("base64")}`;
const body = JSON.stringify({ user: { email: "a@example.com" } });
const sign = (id: string, ts: number, payload: string) => `v1,${createHmac("sha256", raw).update(`${id}.${ts}.${payload}`).digest("base64")}`;
const now = 1_800_000_000;

describe("Supabase hook signatures (Standard Webhooks)", () => {
  it("accepts a correctly signed, fresh request", () => {
    const h = { id: "msg_1", timestamp: String(now), signature: sign("msg_1", now, body) };
    expect(verifyStandardWebhook(body, h, secret, now)).toBe(true);
  });

  it("accepts when one of several signatures matches (key rotation)", () => {
    const h = { id: "msg_1", timestamp: String(now), signature: `v1,AAAA ${sign("msg_1", now, body)}` };
    expect(verifyStandardWebhook(body, h, secret, now)).toBe(true);
  });

  it("rejects a changed body, wrong secret, old timestamp or missing headers", () => {
    const h = { id: "msg_1", timestamp: String(now), signature: sign("msg_1", now, body) };
    expect(verifyStandardWebhook(body.replace("a@", "b@"), h, secret, now)).toBe(false);
    expect(verifyStandardWebhook(body, h, `v1,whsec_${Buffer.from("another-secret").toString("base64")}`, now)).toBe(false);
    expect(verifyStandardWebhook(body, h, secret, now + 600)).toBe(false);
    expect(verifyStandardWebhook(body, { ...h, signature: "" }, secret, now)).toBe(false);
    expect(verifyStandardWebhook(body, h, "", now)).toBe(false);
  });
});
