import { after } from "next/server";
import { accountsEnabled } from "@/lib/config";
import { recordHit, visitor } from "@/lib/galleryStats";
import { eventZipStream, zipName } from "@/lib/eventZip";
import { isShareToken } from "@/lib/gallery";
import { publicEventByToken } from "@/lib/galleryServer";
import { hasAccess } from "../access";

export const maxDuration = 300; // big events take a while to stream

/** The host's "Download all": the event as one zip, when the operator allows it. */
export async function GET(_request: Request, { params }: RouteContext<"/e/[token]/download">) {
  const { token } = await params;
  const event = accountsEnabled && isShareToken(token) ? await publicEventByToken(token) : null;
  if (!event || !event.linkEnabled || !event.allowDownloadAll || !(await hasAccess(event))) return new Response("Not available", { status: 404 });
  const who = await visitor();
  after(() => recordHit(event.id, "zip", who));
  return new Response(eventZipStream(event.id), {
    headers: { "content-type": "application/zip", "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(zipName(event.name))}`, "cache-control": "no-store" },
  });
}
