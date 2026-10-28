import { createHmac, timingSafeEqual } from "node:crypto";

const TOLERANCE_SECONDS = 5 * 60;

/**
 * Standard Webhooks verification, as Supabase Auth hooks sign them: HMAC-SHA256 over
 * "<id>.<timestamp>.<body>" with the secret from the dashboard ("v1,whsec_<base64>").
 */
export function verifyStandardWebhook(
  body: string,
  h: { id: string | null; timestamp: string | null; signature: string | null },
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  if (!secret || !h.id || !h.timestamp || !h.signature) return false;
  const ts = Number(h.timestamp);
  if (!Number.isFinite(ts) || Math.abs(nowSeconds - ts) > TOLERANCE_SECONDS) return false;
  const key = Buffer.from(secret.replace(/^v1,/, "").replace(/^whsec_/, ""), "base64");
  if (!key.length) return false;
  const expected = createHmac("sha256", key).update(`${h.id}.${h.timestamp}.${body}`).digest();
  return h.signature.split(" ").some((part) => {
    const given = Buffer.from(part.replace(/^v1,/, ""), "base64");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}
