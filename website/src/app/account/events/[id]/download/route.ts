import { getEvent } from "@/lib/cloudEvents";
import { eventZipStream, zipName } from "@/lib/eventZip";
import { isUuid } from "@/lib/gallery";
import { getCurrentUser } from "@/lib/supabase/server";

export const maxDuration = 300;

/** The operator's "Download all": every session, hidden ones included. */
export async function GET(_request: Request, { params }: RouteContext<"/account/events/[id]/download">) {
  const { id } = await params;
  const user = await getCurrentUser();
  const event = user && isUuid(id) ? await getEvent(user.id, id) : null;
  if (!event) return new Response("Not found", { status: 404 });
  return new Response(eventZipStream(event.id, { includeHidden: true }), {
    headers: { "content-type": "application/zip", "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(zipName(event.name))}`, "cache-control": "no-store" },
  });
}
