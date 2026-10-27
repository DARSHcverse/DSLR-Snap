import { useCallback, useEffect, useRef, useState } from 'react'
import type { BoothEvent, VideoResult } from '@shared/types'

type State =
  | { name: 'welcome' }
  | { name: 'countdown'; remaining: number }
  | { name: 'recording'; elapsed: number }
  | { name: 'saving' }
  | { name: 'done'; result: VideoResult; playback: string }
  | { name: 'error'; message: string }

const COUNTDOWN = 3

/** Best recorder format this Chromium supports; ffmpeg converts it to MP4 afterwards. */
function recorderType(): string | undefined {
  return ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find((t) => MediaRecorder.isTypeSupported(t))
}

/**
 * Video guestbook: guests record a message with the webcam (any USB webcam, or a GoPro in webcam
 * mode). The DSLR keeps doing stills; Canon's SDK can't stream video to a PC.
 */
export default function VideoBooth({ event, paused, onNeedSetup }: { event: BoothEvent; paused: boolean; onNeedSetup: () => void }) {
  const [state, setState] = useState<State>({ name: 'welcome' })
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const video = useRef<HTMLVideoElement>(null)
  const recorder = useRef<MediaRecorder | null>(null)
  const sessionId = useRef<string | null>(null)

  // Open the webcam and microphone chosen under Printer & devices (system defaults otherwise).
  useEffect(() => {
    let live: MediaStream | null = null
    let stop = false
    ;(async () => {
      try {
        const s = await window.booth.getDeviceSettings()
        live = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: s.videoInputId ? { exact: s.videoInputId } : undefined, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: { deviceId: s.audioInputId ? { exact: s.audioInputId } : undefined, echoCancellation: false, noiseSuppression: true }
        })
        if (stop) return live.getTracks().forEach((t) => t.stop())
        setStream(live)
      } catch (e) {
        setCameraError(e instanceof Error && e.name === 'NotFoundError' ? 'No webcam found. Plug one in, or choose it under Printer & devices.' : `Webcam unavailable: ${e instanceof Error ? e.message : e}`)
      }
    })()
    return () => {
      stop = true
      live?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  useEffect(() => {
    if (video.current && stream && state.name !== 'done') video.current.srcObject = stream
  }, [stream, state.name])

  const reset = useCallback(() => {
    setState((s) => {
      if (s.name === 'done') URL.revokeObjectURL(s.playback)
      return { name: 'welcome' }
    })
    sessionId.current = null
  }, [])

  const start = async () => {
    if (!stream || paused) return
    try {
      sessionId.current = (await window.booth.startSession()).sessionId
      setState({ name: 'countdown', remaining: COUNTDOWN })
    } catch (e) {
      setState({ name: 'error', message: e instanceof Error ? e.message : String(e) })
    }
  }

  const stopRecording = () => recorder.current?.state === 'recording' && recorder.current.stop()

  // Countdown, then record.
  useEffect(() => {
    if (state.name !== 'countdown') return
    const t = setTimeout(() => {
      if (state.remaining > 1) return setState({ name: 'countdown', remaining: state.remaining - 1 })
      const chunks: Blob[] = []
      const type = recorderType()
      const rec = new MediaRecorder(stream!, { mimeType: type, videoBitsPerSecond: 6_000_000 })
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
      rec.onstop = async () => {
        setState({ name: 'saving' })
        const blob = new Blob(chunks, { type: type ?? 'video/webm' })
        try {
          const result = await window.booth.finishVideo(sessionId.current!, await blob.arrayBuffer())
          setState({ name: 'done', result, playback: URL.createObjectURL(blob) })
        } catch (e) {
          setState({ name: 'error', message: e instanceof Error ? e.message.replace(/^Error invoking remote method '[^']+': Error: /, '') : String(e) })
        }
      }
      recorder.current = rec
      rec.start(1000)
      setState({ name: 'recording', elapsed: 0 })
    }, 1000)
    return () => clearTimeout(t)
  }, [state, stream])

  // Recording timer; stops at the event's limit.
  useEffect(() => {
    if (state.name !== 'recording') return
    if (state.elapsed >= event.videoSeconds) return void stopRecording()
    const t = setTimeout(() => setState({ name: 'recording', elapsed: state.elapsed + 1 }), 1000)
    return () => clearTimeout(t)
  }, [state, event.videoSeconds])

  // The final screen goes back to the start by itself.
  useEffect(() => {
    if (state.name !== 'done' && state.name !== 'error') return
    const t = setTimeout(reset, event.doneScreenSeconds * 1000 + (state.name === 'done' ? event.videoSeconds * 1000 : 0))
    return () => clearTimeout(t)
  }, [state.name, event.doneScreenSeconds, event.videoSeconds, reset])

  const prompt = event.videoPrompt.trim() || `Leave a message for ${event.name}`

  return (
    <div className="screen booth video-booth">
      {state.name !== 'done' && <video ref={video} className="webcam mirror" autoPlay muted playsInline />}

      {paused && state.name === 'welcome' && (
        <div className="paused-overlay">
          <p className="eyebrow">{event.name}</p>
          <h1 className="display small">Back in a moment</h1>
          <p className="muted">The video guestbook is taking a short break.</p>
        </div>
      )}

      {state.name === 'welcome' && (
        <div className="welcome over-live" onClick={start}>
          <p className="eyebrow">{event.name}</p>
          <h1 className="display small">{prompt}</h1>
          <p className="muted">Up to {event.videoSeconds} seconds · tap to start recording</p>
          <button className="btn huge primary" disabled={!stream} onClick={(e) => (e.stopPropagation(), void start())}>
            {stream ? 'Record a message' : 'Webcam not ready'}
          </button>
          {cameraError && <p className="warn">{cameraError}</p>}
          <button className="operator-btn" aria-label="Operator menu" onClick={(e) => (e.stopPropagation(), onNeedSetup())}>⚙</button>
        </div>
      )}

      {state.name === 'countdown' && (
        <div className="capture-stage">
          <div className="shot-counter">Get ready</div>
          <div className="countdown" key={state.remaining}>{state.remaining}</div>
        </div>
      )}

      {state.name === 'recording' && (
        <div className="capture-stage recording-stage">
          <div className="shot-counter rec">● REC {event.videoSeconds - state.elapsed}s</div>
          <div className="rec-bar"><span style={{ width: `${(state.elapsed / event.videoSeconds) * 100}%` }} /></div>
          <button className="btn huge primary stop-btn" onClick={stopRecording}>Stop</button>
        </div>
      )}

      {state.name === 'saving' && (
        <div className="center">
          <div className="spinner" />
          <h2 className="title">Saving your message…</h2>
        </div>
      )}

      {state.name === 'done' && (
        <div className="done">
          <video className="final" src={state.playback} autoPlay playsInline controls />
          <div className="done-side">
            <h2 className="title">Thank you!</h2>
            <p className="muted">Your message is saved for {event.name}.</p>
            {state.result.qrDataUrl && (
              <div className="qr">
                <img src={state.result.qrDataUrl} alt="QR code for your video" />
                <p>Scan to download</p>
              </div>
            )}
            <button className="btn primary" onClick={reset}>Finish</button>
          </div>
        </div>
      )}

      {state.name === 'error' && (
        <div className="center">
          <h2 className="title">That one didn't save</h2>
          <p className="muted">{state.message}</p>
          <button className="btn primary" onClick={reset}>Try again</button>
        </div>
      )}
    </div>
  )
}
