import { useEffect, useRef, useState } from 'react'
import { type KeyColour, keyAlpha } from '@shared/chroma'

/**
 * Polls the camera for live-view frames (~12 fps) while `active`. Keep it mounted across
 * booth screens so the feed doesn't restart (and go black) between photos.
 * If the camera has no live view, shows `hint` (if given) so the flow still works.
 * `filter` previews the event's look (CSS approximation) so guests pose for it.
 */
export default function LiveView({ active, hint, filter, chroma, aiBackgroundId }: {
  active: boolean
  hint?: string
  filter?: string
  /** Green/blue screen preview: the backdrop is replaced by `background` (a data URL) live. */
  chroma?: { key: KeyColour; background: string }
  /** AI backgrounds: frames arrive already cut out over this background (and mirrored) from the app. */
  aiBackgroundId?: string
}) {
  const aiBg = useRef(aiBackgroundId)
  aiBg.current = aiBackgroundId
  const [frame, setFrame] = useState<string | null>(null)
  const [supported, setSupported] = useState<boolean | null>(null)

  useEffect(() => {
    if (!active) return
    let stop = false
    ;(async () => {
      const ok = await window.booth.liveViewStart().catch(() => false)
      if (stop) return
      setSupported(ok)
      while (ok && !stop) {
        const started = performance.now()
        const f = await window.booth.liveViewFrame(aiBg.current ? { aiBackgroundId: aiBg.current } : undefined).catch(() => null)
        if (f && !stop) setFrame(f)
        await new Promise((r) => setTimeout(r, Math.max(0, 80 - (performance.now() - started))))
      }
    })()
    return () => {
      stop = true
      setFrame(null)
      setSupported(null)
      void window.booth.liveViewStop()
    }
  }, [active])

  if (!active) return null
  if (chroma && supported !== false) return <div className="liveview">{frame && <KeyedFrame frame={frame} chroma={chroma} filter={filter} />}</div>
  if (supported === false) {
    return <div className="liveview placeholder">{hint && <p>{hint}</p>}</div>
  }
  return <div className="liveview">{frame && <img src={frame} alt="" className={aiBackgroundId ? undefined : 'mirror'} style={filter ? { filter } : undefined} />}</div>
}

/**
 * Live green-screen preview on a canvas: the client's background stays the right way round (logos
 * readable) while the person is mirrored, as guests expect. Same key maths as the print.
 */
function KeyedFrame({ frame, chroma, filter }: { frame: string; chroma: { key: KeyColour; background: string }; filter?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const bg = useRef<HTMLImageElement | null>(null)
  const work = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const img = new Image()
    img.onload = () => (bg.current = img)
    img.src = chroma.background
  }, [chroma.background])

  useEffect(() => {
    const img = new Image()
    img.onload = () => {
      const c = canvas.current
      if (!c) return
      const w = img.naturalWidth
      const h = img.naturalHeight
      if (c.width !== w || c.height !== h) Object.assign(c, { width: w, height: h })
      const ctx = c.getContext('2d')!
      work.current ??= document.createElement('canvas')
      const t = work.current
      if (t.width !== w || t.height !== h) Object.assign(t, { width: w, height: h })
      const tctx = t.getContext('2d', { willReadFrequently: true })!
      tctx.drawImage(img, 0, 0)
      const px = tctx.getImageData(0, 0, w, h)
      const d = px.data
      for (let i = 0; i < d.length; i += 4) d[i + 3] = Math.round(keyAlpha(d[i], d[i + 1], d[i + 2], chroma.key) * 255)
      tctx.putImageData(px, 0, 0)

      ctx.clearRect(0, 0, w, h)
      const b = bg.current
      if (b) {
        // Background "cover", like the print.
        const scale = Math.max(w / b.naturalWidth, h / b.naturalHeight)
        const bw = b.naturalWidth * scale
        const bh = b.naturalHeight * scale
        ctx.drawImage(b, (w - bw) / 2, (h - bh) / 2, bw, bh)
      }
      ctx.save()
      ctx.translate(w, 0)
      ctx.scale(-1, 1)
      ctx.drawImage(t, 0, 0)
      ctx.restore()
    }
    img.src = frame
  }, [frame, chroma.key])

  return <canvas ref={canvas} className="keyed" style={filter ? { filter } : undefined} />
}
