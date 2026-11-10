import { after } from "next/server";
import { latestRelease } from "@/lib/downloads";
import { ipFrom, overLimit } from "@/lib/rateLimit";
import { optedOut, saveSiteEvent, siteEvent } from "@/lib/siteEvents";
import { downloadFrom } from "@/lib/track";

/**
 * The site's download button: counts the download, then sends the browser to the installer on R2.
 * Counted here on the server, so it works without JavaScript and ad blockers can't hide it.
 * Browsers that opted out (GPC / Do Not Track) are still counted, but anonymously.
 */
export async function GET(request: Request) {
  const release = await latestRelease();
  if (!release) return Response.redirect(new URL("/download", request.url), 302);

  const h = request.headers;
  // A browser or Next prefetching the link isn't a download.
  const prefetch = h.has("next-router-prefetch") || h.has("rsc") || /prefetch/i.test(`${h.get("sec-purpose") ?? ""}${h.get("purpose") ?? ""}`);
  if (prefetch) return new Response(null, { status: 204 });
  const from = downloadFrom(new URL(request.url).searchParams.get("from"));
  const row = await siteEvent(h, { name: "download", label: `${from} · v${release.version}`, path: "/download" }, { anonymous: optedOut(h) });
  const ip = ipFrom(h);
  after(async () => {
    if (row && !(await overLimit("track", ip))) await saveSiteEvent(row);
  });
  return new Response(null, { status: 302, headers: { Location: release.url, "Cache-Control": "no-store" } });
}
