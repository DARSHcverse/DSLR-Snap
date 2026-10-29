"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { finishPhotoUploads, startPhotoUploads } from "./designActions";

/** "Add photos": the browser sends each JPEG straight to storage, then they appear in the event. */
export function PhotoUpload({ eventId }: { eventId: string }) {
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
    <span className="inline-flex items-center gap-2">
      <label className={`cursor-pointer rounded-full border border-line px-4 py-2 text-sm font-semibold hover:bg-surface-2 ${busy ? "pointer-events-none opacity-50" : ""}`}>
        {busy ? "Uploading…" : "Add photos"}
        <input type="file" accept="image/jpeg" multiple className="hidden" onChange={(e) => e.target.files?.length && add(e.target.files)} />
      </label>
      {status && <span className="text-sm text-muted">{status}</span>}
    </span>
  );
}
