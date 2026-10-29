"use client";

import { useState } from "react";
import { sessionAction } from "./actions";

export interface GridSession {
  id: string;
  photo: string;
  hidden: boolean;
  video: boolean;
  createdAt: string;
}

/** The event's sessions with select, hide/show, delete and cover. Clicking a photo opens the guest's page. */
export function SessionGrid({ eventId, sessions, coverId, albums = [] }: { eventId: string; sessions: GridSession[]; coverId: string | null; albums?: { id: string; name: string }[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setSelected((s) => (s.has(id) ? new Set([...s].filter((x) => x !== id)) : new Set([...s, id])));
  const all = selected.size === sessions.length && sessions.length > 0;
  const btn = "rounded-full border border-line px-3.5 py-1.5 text-sm font-semibold hover:bg-surface-2 disabled:opacity-40";

  return (
    <form action={sessionAction}>
      <input type="hidden" name="event" value={eventId} />
      {[...selected].map((id) => <input key={id} type="hidden" name="session" value={id} />)}
      <div className="sticky top-16 z-10 -mx-1 mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-bg/90 px-3 py-2 backdrop-blur">
        <button type="button" className={btn} onClick={() => setSelected(all ? new Set() : new Set(sessions.map((s) => s.id)))}>{all ? "Clear" : "Select all"}</button>
        <span className="mr-auto text-sm text-muted">{selected.size ? `${selected.size} selected` : `${sessions.length} sessions`}</span>
        <button name="op" value="hide" disabled={!selected.size} className={btn}>Hide</button>
        <button name="op" value="show" disabled={!selected.size} className={btn}>Show</button>
        <button name="op" value="cover" disabled={selected.size !== 1} className={btn} title="Use as the event's cover photo">Set as cover</button>
        {albums.length > 0 && (
          <span className="flex items-center gap-1">
            <select name="album" defaultValue="" className="rounded-full border border-line bg-bg px-3 py-1.5 text-sm" aria-label="Album">
              <option value="">No album</option>
              {albums.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <button name="op" value="move" disabled={!selected.size} className={btn}>Move to album</button>
          </span>
        )}
        <button
          name="op"
          value="delete"
          disabled={!selected.size}
          className={`${btn} border-bad/50 text-bad`}
          onClick={(e) => !confirm(`Delete ${selected.size} session(s) from the cloud for good? Guests' links to them stop working. The copies on your booth computer stay.`) && e.preventDefault()}
        >
          Delete
        </button>
      </div>
      {sessions.length ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {sessions.map((s) => {
            const on = selected.has(s.id);
            return (
              <li key={s.id} className={`relative overflow-hidden rounded-xl border bg-surface ${on ? "border-accent ring-2 ring-accent" : "border-line"}`}>
                <a href={`/s/${s.id}`} target="_blank" rel="noopener">
                  {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed storage URL */}
                  <img src={s.photo} alt="" loading="lazy" className={`aspect-[2/3] w-full object-cover ${s.hidden ? "opacity-35" : ""}`} />
                </a>
                <label className="absolute top-2 right-2 flex size-7 cursor-pointer items-center justify-center rounded-full bg-black/60">
                  <input type="checkbox" checked={on} onChange={() => toggle(s.id)} className="size-4 accent-[var(--color-accent)]" aria-label="Select" />
                </label>
                <span className="absolute bottom-2 left-2 flex gap-1 text-[11px] font-semibold">
                  {s.video && <span className="rounded-full bg-black/60 px-2 py-0.5">▶ Video</span>}
                  {s.hidden && <span className="rounded-full bg-black/60 px-2 py-0.5">Hidden</span>}
                  {s.id === coverId && <span className="rounded-full bg-accent px-2 py-0.5 text-accent-ink">Cover</span>}
                </span>
                <span className="absolute right-2 bottom-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px]">
                  {new Date(s.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" })}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-card border border-line bg-surface p-8 text-center text-muted">No photos yet. They appear here as the booth uploads them.</p>
      )}
    </form>
  );
}
