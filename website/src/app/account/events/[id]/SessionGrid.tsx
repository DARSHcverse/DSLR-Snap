"use client";

import { CheckSquare, ChevronLeft, ChevronRight, ExternalLink, Eye, EyeOff, FolderInput, ImageOff, Play, Square, Star, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { sessionAction } from "./actions";

export interface GridSession {
  id: string;
  photo: string;
  hidden: boolean;
  video: boolean;
  createdAt: string;
}

const time = (t: string) => new Date(t).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });

/** The event's sessions with select, hide/show, delete, albums and cover. Clicking a photo opens a large preview. */
export function SessionGrid({ eventId, sessions, coverId, albums = [] }: { eventId: string; sessions: GridSession[]; coverId: string | null; albums?: { id: string; name: string }[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [viewing, setViewing] = useState<number | null>(null);
  const toggle = (id: string) => setSelected((s) => (s.has(id) ? new Set([...s].filter((x) => x !== id)) : new Set([...s, id])));
  const all = selected.size === sessions.length && sessions.length > 0;
  const btn = "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors hover:bg-surface-2 disabled:pointer-events-none disabled:opacity-35";

  useEffect(() => {
    if (viewing === null) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setViewing(null);
      if (e.key === "ArrowRight") setViewing((v) => (v === null ? v : Math.min(sessions.length - 1, v + 1)));
      if (e.key === "ArrowLeft") setViewing((v) => (v === null ? v : Math.max(0, v - 1)));
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [viewing, sessions.length]);

  if (!sessions.length) {
    return (
      <div className="flex flex-col items-center rounded-2xl border border-dashed border-line px-6 py-16 text-center text-muted">
        <ImageOff className="size-10 opacity-50" strokeWidth={1.5} aria-hidden />
        <p className="mt-3 font-semibold text-fg">No photos here yet</p>
        <p className="mt-1 text-sm">They appear as the booth uploads them, or press Upload to add your own.</p>
      </div>
    );
  }
  const open = viewing !== null ? sessions[viewing] : null;

  return (
    <form action={sessionAction}>
      <input type="hidden" name="event" value={eventId} />
      {[...selected].map((id) => <input key={id} type="hidden" name="session" value={id} />)}
      <div className="sticky top-16 z-20 mb-4 flex flex-wrap items-center gap-1 rounded-2xl border border-line bg-bg/90 px-2 py-1.5 backdrop-blur-lg">
        <button type="button" className={btn} onClick={() => setSelected(all ? new Set() : new Set(sessions.map((s) => s.id)))}>
          {all ? <CheckSquare className="size-4 text-accent" aria-hidden /> : <Square className="size-4" aria-hidden />} {all ? "Clear" : "Select all"}
        </button>
        <span className="mr-auto px-2 text-sm text-muted">{selected.size ? `${selected.size} selected` : `${sessions.length} sessions`}</span>
        {selected.size > 0 && (
          <>
            <button name="op" value="hide" className={btn}><EyeOff className="size-4" aria-hidden /> Hide</button>
            <button name="op" value="show" className={btn}><Eye className="size-4" aria-hidden /> Show</button>
            <button name="op" value="cover" disabled={selected.size !== 1} className={btn} title="Use as the event's cover photo"><Star className="size-4" aria-hidden /> Cover</button>
            {albums.length > 0 && (
              <span className="flex items-center gap-1">
                <select name="album" defaultValue="" className="rounded-lg border border-line bg-bg px-2.5 py-1.5 text-sm" aria-label="Album">
                  <option value="">No album</option>
                  {albums.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                <button name="op" value="move" className={btn}><FolderInput className="size-4" aria-hidden /> Move</button>
              </span>
            )}
            <button
              name="op"
              value="delete"
              className={`${btn} text-bad hover:bg-bad/10`}
              onClick={(e) => !confirm(`Delete ${selected.size} session(s) from the cloud for good? Guests' links to them stop working. The copies on your booth computer stay.`) && e.preventDefault()}
            >
              <Trash2 className="size-4" aria-hidden /> Delete
            </button>
          </>
        )}
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
        {sessions.map((s, i) => {
          const on = selected.has(s.id);
          return (
            <li key={s.id} className={`group relative overflow-hidden rounded-xl border bg-surface transition-shadow ${on ? "border-accent ring-2 ring-accent" : "border-line hover:shadow-lg hover:shadow-black/30"}`}>
              <button type="button" onClick={() => setViewing(i)} className="block w-full" aria-label={`Preview session from ${time(s.createdAt)}`}>
                {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed storage URL */}
                <img src={s.photo} alt="" loading="lazy" className={`aspect-[2/3] w-full object-cover transition-transform duration-300 group-hover:scale-[1.02] ${s.hidden ? "opacity-35" : ""}`} />
              </button>
              <label className={`absolute top-2 right-2 flex size-7 cursor-pointer items-center justify-center rounded-lg border-2 backdrop-blur transition-colors ${on ? "border-accent bg-accent text-accent-ink" : "border-white/80 bg-black/30"}`}>
                <input type="checkbox" checked={on} onChange={() => toggle(s.id)} className="sr-only" aria-label="Select" />
                {on && <svg viewBox="0 0 24 24" className="size-4 fill-none stroke-current stroke-[3]" aria-hidden><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>}
              </label>
              <span className="pointer-events-none absolute bottom-2 left-2 flex gap-1 text-[11px] font-semibold text-white">
                {s.video && <span className="inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5"><Play className="size-3" aria-hidden /> Video</span>}
                {s.hidden && <span className="rounded-full bg-black/60 px-2 py-0.5">Hidden</span>}
                {s.id === coverId && <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-accent-ink"><Star className="size-3" aria-hidden /> Cover</span>}
              </span>
              <span className="pointer-events-none absolute right-2 bottom-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] text-white">{time(s.createdAt)}</span>
            </li>
          );
        })}
      </ul>

      {open && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-black/90 backdrop-blur" role="dialog" aria-modal="true" aria-label="Photo preview">
          <div className="flex items-center gap-3 px-4 py-3 text-sm text-white/80">
            <span>{viewing! + 1} of {sessions.length} · {time(open.createdAt)}{open.hidden ? " · hidden" : ""}</span>
            <a href={`/s/${open.id}`} target="_blank" rel="noopener" className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 hover:bg-white/10"><ExternalLink className="size-4" aria-hidden /> Guest page</a>
            <button type="button" onClick={() => setViewing(null)} className="rounded-lg p-2 hover:bg-white/10" aria-label="Close"><X className="size-5" /></button>
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-14 pb-6">
            {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed storage URL */}
            <img src={open.photo} alt="" className="max-h-full max-w-full rounded-lg object-contain shadow-2xl" />
            <button type="button" disabled={viewing === 0} onClick={() => setViewing(viewing! - 1)} className="absolute left-2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20 disabled:opacity-20" aria-label="Previous"><ChevronLeft className="size-6" /></button>
            <button type="button" disabled={viewing === sessions.length - 1} onClick={() => setViewing(viewing! + 1)} className="absolute right-2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20 disabled:opacity-20" aria-label="Next"><ChevronRight className="size-6" /></button>
          </div>
        </div>
      )}
    </form>
  );
}
