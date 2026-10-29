import "server-only";
import { Zip, ZipPassThrough } from "fflate";
import { describeFiles, type GalleryFile, RETENTION_DAYS } from "./gallery";
import { openFile } from "./storage";
import { supabaseAdmin } from "./supabase/server";

// File names inside the zip, by kind (the extension comes from the stored file).
const ZIP_NAMES: Record<string, string> = { photo: "photo", colour: "colour", gif: "animation", boomerang: "boomerang", boomerangVideo: "boomerang", video: "video-message" };

/**
 * "Download all": every visible session's files as one zip, streamed as it's built, so a 600 MB event
 * never sits in memory. Files are stored, not compressed: JPEG/GIF/MP4 are compressed already.
 * Layout: "001 18.42/photo.jpg", "001 18.42/colour.jpg", … in the order guests used the booth.
 */
export function eventZipStream(eventId: string, opts: { includeHidden?: boolean } = {}): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const zip = new Zip((err, chunk, final) => {
        if (err) return controller.error(err);
        controller.enqueue(chunk);
        if (final) controller.close();
      });
      try {
        let q = supabaseAdmin()
          .from("gallery_sessions")
          .select("files, created_at")
          .eq("event_id", eventId)
          .not("ready_at", "is", null)
          .gt("created_at", new Date(Date.now() - RETENTION_DAYS * 86_400_000).toISOString())
          .order("created_at", { ascending: true });
        if (!opts.includeHidden) q = q.is("hidden_at", null);
        const { data } = await q;
        const sessions = (data ?? []) as { files: GalleryFile[]; created_at: string }[];
        for (const [i, s] of sessions.entries()) {
          const time = new Date(s.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }).replace(":", ".");
          const folder = `${String(i + 1).padStart(3, "0")} ${time}`;
          for (const d of describeFiles(s.files)) {
            const file = s.files.find((f) => f.kind === d.kind)!;
            const body = await openFile(file.path);
            if (!body) continue; // a missing file shouldn't spoil the rest of the download
            const ext = file.path.split(".").pop() ?? "jpg";
            const entry = new ZipPassThrough(`${folder}/${ZIP_NAMES[d.kind] ?? d.kind}.${ext}`);
            zip.add(entry);
            const reader = body.getReader();
            for (;;) {
              const { value, done } = await reader.read();
              if (done) break;
              entry.push(value);
            }
            entry.push(new Uint8Array(0), true);
          }
        }
        zip.end();
      } catch (e) {
        controller.error(e);
      }
    },
  });
}

/** A safe file name for the zip from the event name. */
export const zipName = (eventName: string) => `${eventName.replace(/[^\p{L}\p{N} &'_-]/gu, "").trim().slice(0, 60) || "event"} - DSLR Snap.zip`;
