import { useEffect, useRef, useState } from 'react'

type Item = { id: string; createdAt: string; thumb: string; hasGif: boolean }
const IDLE_CLOSE_MS = 60_000

/** Corner button on the welcome screen showing the latest photo. Hidden until there is something to show. */
export function GalleryCorner({ items, onOpen }: { items: Item[]; onOpen: () => void }) {
  if (!items.length) return null
  return (
    <button className="gallery-corner" onClick={(e) => (e.stopPropagation(), onOpen())}>
      <img src={items[0].thumb} alt="" />
      <span>Gallery · {items.length}</span>
    </button>
  )
}

/** Full-screen browser of this event's photos and GIFs. View only: guests can't reprint from here. */
export default function Gallery({ items, onClose }: { items: Item[]; onClose: () => void }) {
  const [open, setOpen] = useState<{ id: string; image: string; gif?: string } | null>(null)
  const [showGif, setShowGif] = useState(false)
  const idle = useRef<ReturnType<typeof setTimeout>>(undefined)

  // An abandoned gallery must never block the booth: close after a minute without touches.
  const poke = () => {
    clearTimeout(idle.current)
    idle.current = setTimeout(onClose, IDLE_CLOSE_MS)
  }
  useEffect(() => {
    poke()
    return () => clearTimeout(idle.current)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const view = async (item: Item) => {
    const full = await window.booth.galleryItem(item.id).catch(() => null)
    if (!full) return
    setOpen({ id: item.id, ...full })
    setShowGif(!!full.gif)
  }

  return (
    <div className="gallery" onPointerDown={poke} onClick={(e) => e.stopPropagation()}>
      <div className="gallery-bar">
        <h2 className="title">{open ? 'Your photos' : 'Photo gallery'}</h2>
        {open?.gif && (
          <div className="seg gallery-toggle">
            <button className={!showGif ? 'on' : ''} onClick={() => setShowGif(false)}>Photo</button>
            <button className={showGif ? 'on' : ''} onClick={() => setShowGif(true)}>GIF</button>
          </div>
        )}
        <button className="close-x" aria-label="Close" onClick={() => (open ? setOpen(null) : onClose())}>✕</button>
      </div>
      {open ? (
        <div className="gallery-view">
          <img src={showGif && open.gif ? open.gif : open.image} alt="" />
        </div>
      ) : (
        <div className="gallery-grid">
          {items.map((it) => (
            <button key={it.id} onClick={() => view(it)}>
              <img src={it.thumb} alt="" />
              <span>{new Date(it.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}{it.hasGif ? ' · GIF' : ''}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
