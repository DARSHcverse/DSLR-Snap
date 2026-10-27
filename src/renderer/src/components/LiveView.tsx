import { useEffect, useState } from 'react'

/**
 * Polls the camera for live-view frames (~12 fps) while `active`. Keep it mounted across
 * booth screens so the feed doesn't restart (and go black) between photos.
 * If the camera has no live view, shows `hint` (if given) so the flow still works.
 * `filter` previews the event's look (CSS approximation) so guests pose for it.
 */
export default function LiveView({ active, hint, filter }: { active: boolean; hint?: string; filter?: string }) {
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
        const f = await window.booth.liveViewFrame().catch(() => null)
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
  if (supported === false) {
    return <div className="liveview placeholder">{hint && <p>{hint}</p>}</div>
  }
  return <div className="liveview">{frame && <img src={frame} alt="" className="mirror" style={filter ? { filter } : undefined} />}</div>
}
