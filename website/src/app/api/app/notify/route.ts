import { deviceFromRequest, fail, notConfigured, readJson, signedOut } from "@/lib/appApi";
import { emailBoothAlert, emailPaperLow } from "@/lib/email/lifecycle";
import { ipFrom, overLimit, tooMany } from "@/lib/rateLimit";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * Alerts a booth sends to the operator (by email, so they reach their phone): paper running low,
 * a print failing, the camera lost mid-event, a print package nearly used up. Each kind is limited
 * per computer (paper: once per roll and threshold; problems: once per half hour), however often
 * the booth asks.
 */
const THRESHOLDS = new Set([50, 15]);
const HALF_HOUR = 30 * 60_000;
const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "") || undefined;

export async function POST(request: Request) {
  if (await overLimit("appOther", ipFrom(request.headers))) return tooMany();
  const off = notConfigured();
  if (off) return off;
  const body = await readJson(request);
  const device = await deviceFromRequest(body);
  if (!device || !body) return signedOut();
  const { data } = await supabaseAdmin().from("devices").select("name").eq("id", device.id).maybeSingle();
  const name = data?.name ?? "Your booth";
  const event = text(body.event, 120);
  const bucket = Math.floor(Date.now() / HALF_HOUR);

  switch (body.kind) {
    case "paper_low": {
      const remaining = Number(body.remaining);
      const capacity = Number(body.capacity);
      const threshold = Number(body.threshold);
      const roll = typeof body.roll === "string" && !Number.isNaN(Date.parse(body.roll)) ? new Date(body.roll).toISOString() : null;
      if (!Number.isInteger(remaining) || !Number.isInteger(capacity) || remaining < 0 || capacity < 1 || capacity > 5000 || !THRESHOLDS.has(threshold) || !roll) {
        return fail(400, "invalid_request", "Bad request.");
      }
      await emailPaperLow(device.userId, { device: name, remaining, capacity, event }, `paper:${device.id}:${roll}:${threshold}`);
      break;
    }
    case "printer_error":
      await emailBoothAlert(
        device.userId,
        { title: "A print failed", device: name, event, detail: text(body.message, 200), advice: "Check the printer (paper, ribbon, door, cable), then press Retry in DSLR Snap's Print queue. Nothing prints twice." },
        `printer:${device.id}:${bucket}`,
      );
      break;
    case "camera_lost":
      await emailBoothAlert(
        device.userId,
        { title: "The camera is disconnected", device: name, event, detail: text(body.message, 200), advice: "Guests can't take photos. Check the camera is on and its USB cable and battery; DSLR Snap reconnects by itself." },
        `camera:${device.id}:${bucket}`,
      );
      break;
    case "print_limit": {
      const used = Number(body.used);
      const limit = Number(body.limit);
      if (!Number.isInteger(used) || !Number.isInteger(limit) || limit < 1 || limit > 100_000) return fail(400, "invalid_request", "Bad request.");
      const done = used >= limit;
      await emailBoothAlert(
        device.userId,
        {
          title: done ? "Print package used up" : "Print package nearly used up",
          device: name,
          event,
          detail: `${used} of ${limit} prints`,
          advice: done ? "The booth now gives guests their photos digitally, with no print. Raise the limit in the event's Print & share step to keep printing." : "When it runs out, guests get their photos digitally only. Raise the limit in the event's Print & share step if the client wants more.",
        },
        `print_limit:${device.id}:${event ?? ""}:${limit}:${done ? "done" : "near"}`,
      );
      break;
    }
    default:
      return fail(400, "invalid_request", "Bad request.");
  }
  return Response.json({ ok: true });
}
