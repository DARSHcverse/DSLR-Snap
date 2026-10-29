import { accountsEnabled } from "@/lib/config";
import { isShareToken } from "@/lib/gallery";
import { eventSessions, publicEventByToken } from "@/lib/galleryServer";
import { hasAccess } from "../../access";

/** The slideshow's photo list: visible sessions, newest first, full-size, re-signed on every poll. */
export async function GET(_request: Request, { params }: RouteContext<"/e/[token]/slideshow/feed">) {
  const { token } = await params;
  const event = accountsEnabled && isShareToken(token) ? await publicEventByToken(token) : null;
  if (!event || !event.linkEnabled || !(await hasAccess(event))) return Response.json({ error: "not_available" }, { status: 404 });
  const sessions = await eventSessions(event.id, { full: true, limit: 300 });
  return Response.json(
    { photos: sessions.map((s) => ({ id: s.id, url: s.photo, at: s.createdAt })) },
    { headers: { "cache-control": "no-store" } },
  );
}
