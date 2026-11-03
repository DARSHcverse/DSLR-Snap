import { deviceFromRequest, fail, notConfigured, readJson, signedOut } from "@/lib/appApi";
import { ipFrom, overLimit, tooMany } from "@/lib/rateLimit";
import { listFiles, removeFiles, uploadUrl, viewUrls } from "@/lib/storage";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * A booth's setup (templates and preferences), saved so another of the operator's computers can
 * copy it. The app builds and re-checks the setup itself; this route only stores it, limits its
 * size and hands out short-lived links for each template's artwork PNG.
 *   { op: "save", setup, artwork: [templateId…] } → { uploads: { id: { url, headers } } }
 *   { op: "get" } → { setup, artwork: { id: url } }
 */
const ARTWORK_ID = /^imported-[0-9a-f]{8}$/;
const MAX_BYTES = 400_000;
const folder = (userId: string) => `${userId}/setup`;

export async function POST(request: Request) {
  if (await overLimit("appSettings", ipFrom(request.headers))) return tooMany();
  const off = notConfigured();
  if (off) return off;
  const body = await readJson(request);
  const device = await deviceFromRequest(body);
  if (!device) return signedOut();
  const db = supabaseAdmin();
  const dir = folder(device.userId);

  if (body?.op === "save") {
    const setup = body.setup as Record<string, unknown> | undefined;
    const artwork = Array.isArray(body.artwork) ? (body.artwork as unknown[]).filter((id): id is string => typeof id === "string" && ARTWORK_ID.test(id)) : [];
    if (!setup || typeof setup !== "object" || setup.version !== 1 || JSON.stringify(setup).length > MAX_BYTES || artwork.length > 50) {
      return fail(400, "invalid_request", "That setup is too big or not understood. Update DSLR Snap.");
    }
    const { error } = await db.from("app_settings").upsert({ user_id: device.userId, booth_setup: setup, booth_setup_at: new Date().toISOString() });
    if (error) return fail(500, "server_error", "Couldn't save your setup. Try again.");
    // Artwork from an older save that's no longer in this one is removed.
    const keep = new Set(artwork.map((id) => `${dir}/${id}.png`));
    const stale = (await listFiles(dir).catch(() => [] as string[])).filter((p) => !keep.has(p));
    if (stale.length) await removeFiles(stale).catch(() => undefined);
    const uploads = Object.fromEntries(await Promise.all(artwork.map(async (id) => [id, await uploadUrl(`${dir}/${id}.png`, "image/png")] as const)));
    return Response.json({ uploads });
  }

  if (body?.op === "get") {
    const { data } = await db.from("app_settings").select("booth_setup").eq("user_id", device.userId).maybeSingle();
    const setup = data?.booth_setup ?? null;
    const files = await listFiles(dir).catch(() => [] as string[]);
    const urls = await viewUrls(files);
    const artwork = Object.fromEntries(files.flatMap((p) => {
      const id = p.slice(dir.length + 1).replace(/\.png$/, "");
      return ARTWORK_ID.test(id) && urls.get(p) ? [[id, urls.get(p)!]] : [];
    }));
    return Response.json({ setup, artwork });
  }

  return fail(400, "invalid_request", "Bad request.");
}
