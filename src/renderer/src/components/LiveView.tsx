import { useEffect, useRef, useState } from 'react'

/**
 * Polls the camera for live-view frames (~12 fps). If the camera has no live view,
 * shows a "look at the camera" prompt instead so the flow still works.
 */
export default function LiveView({ active }: { active: boolean }) {
  const [frame, setFrame] = useState<string | null>(null)
  const [supported, setSupported] = useState<boolean | null>(null)
  const running = useRef(false)

  useEffect(() => {
    if (!active) return
    let stop = false
    running.current = true
    ;(async () => {
      const ok = await window.booth.liveViewStart().catch(() => false)
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
      running.current = false
      void window.booth.liveViewStop()
    }
  }, [active])

  if (supported === false) {
    return (
      <div className="liveview placeholder">
        <p>Look at the camera ↑</p>
      </div>
    )
  }
  return <div className="liveview">{frame && <img src={frame} alt="" className="mirror" />}</div>
}
