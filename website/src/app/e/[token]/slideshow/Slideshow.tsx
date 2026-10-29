"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Photo {
  id: string;
  url: string;
  at: string;
}

const SLIDE_MS = 7000;
const POLL_MS = 10_000;

/**
 * Full-screen slideshow for a venue TV. New photos jump the queue as guests take them; otherwise it
 * cycles through the event. Hidden photos drop out on the next poll, so the operator can moderate live.
 */
export function Slideshow({ token, eventName, qr, galleryUrl }: { token: string; eventName: string; qr: string; galleryUrl: string }) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [current, setCurrent] = useState<Photo | null>(null);
  const [controls, setControls] = useState(true);
  const queue = useRef<string[]>([]); // new arrivals to show next
  const seen = useRef<Set<string>>(new Set());
  const cursor = useRef(0);
  const first = useRef(true);

  const poll = useCallback(async () => {
    const res = await fetch(`/e/${token}/slideshow/feed`, { cache: "no-store" }).catch(() => null);
    if (!res?.ok) return;
    const { photos: list } = (await res.json()) as { photos: Photo[] };
    for (const p of list) {
      if (!seen.current.has(p.id)) {
        seen.current.add(p.id);
        if (!first.current) queue.current.push(p.id); // arrivals after the slideshow started go first
      }
    }
    first.current = false;
    setPhotos(list);
    for (const p of list.slice(0, 2)) new Image().src = p.url; // warm the cache for the next slides
  }, [token]);

  useEffect(() => {
    const kick = setTimeout(poll, 0);
    const t = setInterval(poll, POLL_MS);
    return () => (clearTimeout(kick), clearInterval(t));
  }, [poll]);

  // Advance: a new arrival if there is one, else the next photo in order (newest first, looping).
  useEffect(() => {
    if (!photos.length) return;
    const next = () => {
      const byId = new Map(photos.map((p) => [p.id, p]));
      let pick: Photo | undefined;
      while (!pick && queue.current.length) pick = byId.get(queue.current.shift()!);
      if (!pick) {
        cursor.current = cursor.current % photos.length;
        pick = photos[cursor.current++];
      }
      setCurrent(pick);
    };
    if (!current || !photos.some((p) => p.id === current.id)) next(); // first photo, or the current one was hidden
    const t = setInterval(next, SLIDE_MS);
    return () => clearInterval(t);
  }, [photos, current]);

  // Controls show on mouse movement, then fade away with the cursor.
  useEffect(() => {
    let t = setTimeout(() => setControls(false), 3000);
    const show = () => {
      setControls(true);
      clearTimeout(t);
      t = setTimeout(() => setControls(false), 3000);
    };
    window.addEventListener("mousemove", show);
    return () => (window.removeEventListener("mousemove", show), clearTimeout(t));
  }, []);

  return (
    <div className={`fixed inset-0 overflow-hidden bg-[var(--color-bg)] ${controls ? "" : "cursor-none"}`}>
      {current ? (
        // eslint-disable-next-line @next/next/no-img-element -- short-lived signed storage URL
        <img key={current.id} src={current.url} alt="" className="slideshow-in absolute inset-0 m-auto max-h-full max-w-full object-contain p-[3vh]" />
      ) : (
        <div className="flex size-full flex-col items-center justify-center gap-3 text-center">
          <p className="font-display text-5xl font-bold">{eventName}</p>
          <p className="text-xl text-muted">Photos appear here as guests use the booth.</p>
        </div>
      )}

      <div className="absolute right-[2vw] bottom-[2vw] flex items-center gap-3 rounded-2xl bg-[var(--color-bg)]/80 p-3 backdrop-blur">
        {/* eslint-disable-next-line @next/next/no-img-element -- generated data URL */}
        <img src={qr} alt="" className="size-[11vh] min-h-20 min-w-20 rounded-lg" />
        <p className="max-w-[16vw] text-[clamp(12px,1.6vh,20px)] leading-snug">
          <span className="block font-semibold">Scan for everyone&apos;s photos</span>
          <span className="text-muted">{eventName}</span>
        </p>
      </div>

      <div className={`absolute top-4 right-4 flex gap-2 transition-opacity ${controls ? "opacity-100" : "pointer-events-none opacity-0"}`}>
        <button
          type="button"
          onClick={() => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => undefined)}
          className="rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[var(--color-accent-ink)]"
        >
          Full screen
        </button>
        <a href={galleryUrl} className="rounded-full border border-line bg-[var(--color-bg)]/70 px-4 py-2 text-sm font-semibold">Exit</a>
      </div>
    </div>
  );
}
