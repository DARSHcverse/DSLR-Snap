import { deviceFromRequest, fail, notConfigured, readJson, signedOut } from "@/lib/appApi";
import { emailPaperLow } from "@/lib/email/lifecycle";
import { ipFrom, overLimit, tooMany } from "@/lib/rateLimit";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * Alerts a booth sends to the operator (by email, so they reach their phone). Today: paper running
 * low. Each one goes once per computer, roll and threshold, however often the booth asks.
 */
const THRESHOLDS = new Set([50, 15]);

export async function POST(request: Request) {
  if (await overLimit("appOther", ipFrom(request.headers))) return tooMany();
  const off = notConfigured();
  if (off) return off;
  const body = await readJson(request);
  const device = await deviceFromRequest(body);
  if (!device) return signedOut();
  if (body?.kind !== "paper_low") return fail(400, "invalid_request", "Bad request.");
  const remaining = Number(body.remaining);
  const capacity = Number(body.capacity);
  const threshold = Number(body.threshold);
  const roll = typeof body.roll === "string" && !Number.isNaN(Date.parse(body.roll)) ? new Date(body.roll).toISOString() : null;
  if (!Number.isInteger(remaining) || !Number.isInteger(capacity) || remaining < 0 || capacity < 1 || capacity > 5000 || !THRESHOLDS.has(threshold) || !roll) {
    return fail(400, "invalid_request", "Bad request.");
  }
  const { data } = await supabaseAdmin().from("devices").select("name").eq("id", device.id).maybeSingle();
  const event = typeof body.event === "string" ? body.event.trim().slice(0, 120) : undefined;
  await emailPaperLow(device.userId, { device: data?.name ?? "Your booth", remaining, capacity, event: event || undefined }, `paper:${device.id}:${roll}:${threshold}`);
  return Response.json({ ok: true });
}
