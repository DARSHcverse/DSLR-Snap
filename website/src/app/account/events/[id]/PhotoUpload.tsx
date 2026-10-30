"use client";

import { ImagePlus, Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { finishPhotoUploads, startPhotoUploads } from "./designActions";

/** "Upload": the browser sends each JPEG straight to storage, then they appear in the event. */
export function PhotoUpload({ eventId, className }: { eventId: string; className: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const add = async (list: FileList) => {
    const files = [...list];
    setBusy(true);
    setStatus(`Preparing ${files.length} photo${files.length === 1 ? "" : "s"}…`);
    const start = await startPhotoUploads(eventId, files.map((f) => ({ type: f.type, size: f.size })));
    if ("error" in start) {
      setStatus(start.error ?? "Couldn't upload.");
      setBusy(false);
      return;
    }
    const done: string[] = [];
    for (const [i, u] of start.uploads.entries()) {
      setStatus(`Uploading ${i + 1} of ${files.length}…`);
      const res = await fetch(u.url, { method: "PUT", body: files[i], headers: { ...u.headers, "content-type": "image/jpeg", "x-upsert": "true" } }).catch(() => null);
      if (res?.ok) done.push(u.sessionId);
    }
    const { added } = await finishPhotoUploads(eventId, done);
    setStatus(added === files.length ? `Added ${added} photo${added === 1 ? "" : "s"}.` : `Added ${added} of ${files.length}; the rest didn't upload. Try them again.`);
    setBusy(false);
    router.refresh();
  };

  return (
    <>
      <label className={`${className} cursor-pointer ${busy ? "pointer-events-none opacity-60" : ""}`}>
        {busy ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <ImagePlus className="size-5" aria-hidden />}
        {busy ? "Uploading" : "Upload"}
        <input type="file" accept="image/jpeg" multiple className="hidden" onChange={(e) => e.target.files?.length && add(e.target.files)} />
      </label>
      {status && (
        <div role="status" className="fixed right-4 bottom-4 z-50 flex max-w-sm items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-sm shadow-2xl shadow-black/50 sm:right-6 sm:bottom-6">
          {busy && <Loader2 className="size-4 shrink-0 animate-spin text-accent" aria-hidden />}
          <span className="flex-1">{status}</span>
          {!busy && <button onClick={() => setStatus(null)} className="rounded p-1 text-muted hover:text-fg" aria-label="Dismiss"><X className="size-4" /></button>}
        </div>
      )}
    </>
  );
}
