import { BarChart3, Code2, Download, FolderPlus, MonitorPlay, Pencil, QrCode, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { toolButton as tool } from "@/components/dash/ui";
import { eventAlbums } from "@/lib/galleryServer";
import { addAlbum, changeAlbum } from "./actions";
import { ownedEvent } from "./data";
import { PhotoUpload } from "./PhotoUpload";
import { SessionGrid } from "./SessionGrid";

export const metadata: Metadata = { title: "Event" };

/** The event's photos: tools across the top, albums, then the grid with select and bulk actions. */
export default function EventPhotosPage({ params, searchParams }: PageProps<"/account/events/[id]">) {
  return (
    <Suspense fallback={<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <div key={i} className="aspect-[2/3] animate-pulse rounded-xl bg-surface-2/40" />)}</div>}>
      <Photos params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Photos({ params, searchParams }: PageProps<"/account/events/[id]">) {
  const { id } = await params;
  const { event, sessions } = await ownedEvent(id);
  const albums = await eventAlbums(event.id, { includeHidden: true });
  const albumParam = (await searchParams).album;
  const album = albums.find((a) => a.id === albumParam) ?? null;
  const shown = album ? sessions.filter((s) => s.albumId === album.id) : sessions;
  const base = `/account/events/${event.id}`;
  const chip = (on: boolean) => `inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition-colors ${on ? "border-accent bg-accent/10 font-semibold text-fg" : "border-line text-muted hover:text-fg"}`;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-4 gap-1 rounded-2xl border border-line bg-surface p-1.5 sm:flex sm:[&>*]:flex-1">
        {sessions.length > 0 && <a href={`${base}/download`} className={tool}><Download className="size-5" aria-hidden /> Download all</a>}
        <PhotoUpload eventId={event.id} className={tool} />
        <a href={`/e/${event.shareToken}/slideshow`} target="_blank" rel="noopener" className={tool}><MonitorPlay className="size-5" aria-hidden /> Slideshow</a>
        <Link href={`${base}/sharing`} className={tool}><QrCode className="size-5" aria-hidden /> QR code</Link>
        <Link href={`${base}/sharing#embed`} className={tool}><Code2 className="size-5" aria-hidden /> Embed</Link>
        <Link href={`${base}/analytics`} className={tool}><BarChart3 className="size-5" aria-hidden /> Analytics</Link>
        <Link href={`${base}/settings#delete`} className={`${tool} hover:text-bad`}><Trash2 className="size-5" aria-hidden /> Delete event</Link>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Link href={base} className={chip(!album)}>All <span className="text-muted">{sessions.length}</span></Link>
        {albums.map((a) => (
          <Link key={a.id} href={`${base}?album=${a.id}`} className={chip(album?.id === a.id)}>
            {a.name} <span className="text-muted">{a.count}</span>
          </Link>
        ))}
        <form action={addAlbum} className="flex items-center gap-1">
          <input type="hidden" name="event" value={event.id} />
          <input name="name" placeholder="New album" maxLength={60} required aria-label="New album name" className="w-32 rounded-full border border-dashed border-line bg-transparent px-3.5 py-1.5 text-sm placeholder:text-muted focus:border-accent focus:outline-none" />
          <button className="rounded-full p-2 text-muted hover:bg-surface-2 hover:text-fg" aria-label="Add album" title="Add album"><FolderPlus className="size-4" /></button>
        </form>
      </div>
      {album && (
        <form action={changeAlbum} className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-sm">
          <Pencil className="size-4 text-muted" aria-hidden />
          <input type="hidden" name="event" value={event.id} />
          <input type="hidden" name="album" value={album.id} />
          <input name="name" defaultValue={album.name} maxLength={60} aria-label="Album name" className="rounded-lg border border-line bg-bg px-3 py-1.5" />
          <button name="op" value="rename" className="rounded-lg border border-line px-3 py-1.5 font-semibold hover:bg-surface-2">Rename</button>
          <button name="op" value="delete" className="ml-auto text-bad hover:underline">Delete album (photos stay in the event)</button>
        </form>
      )}
      <SessionGrid eventId={event.id} sessions={shown} coverId={event.coverSessionId} albums={albums} />
    </div>
  );
}
