import { entitlementFor } from "@/lib/account";
import { deviceFromRequest, fail, notConfigured, readJson, signedOut } from "@/lib/appApi";
import { appUrl } from "@/lib/config";
import { isUuid } from "@/lib/gallery";
import { galleryEventFor } from "@/lib/galleryServer";

/** The host's link for an event: every photo on one page. */
export async function POST(request: Request) {
  const off = notConfigured();
  if (off) return off;
  const body = await readJson(request);
  const device = await deviceFromRequest(body);
  if (!device) return signedOut();
  if (!(await entitlementFor(device.userId)).active) {
    return fail(402, "subscription_required", "The host gallery needs an active plan. Choose one at dslrsnap.com/account.");
  }
  const ev = (body?.event ?? {}) as Record<string, unknown>;
  if (!isUuid(ev.id)) return fail(400, "invalid_request", "Bad event.");
  const event = await galleryEventFor(device.userId, {
    id: ev.id,
    name: typeof ev.name === "string" && ev.name.trim() ? ev.name.trim().slice(0, 120) : "Event",
    date: typeof ev.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(ev.date) ? ev.date : null,
  });
  return Response.json({ url: `${appUrl}/e/${event.share_token}` });
}
