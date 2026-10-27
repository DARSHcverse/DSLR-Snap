import { execFile, spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { promisify } from 'node:util'

const run = promisify(execFile)

/**
 * Finds ffmpeg. Installed app: the LGPL Windows build shipped in resources/ffmpeg. Development:
 * resources/ffmpeg/<platform> if fetched, else the dev-only ffmpeg-static package (GPL, never
 * shipped), else ffmpeg on the PATH.
 */
export function locateFfmpeg(opts: { resourcesDir?: string; appDir?: string }): string | null {
  const exe = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
  const candidates = [
    opts.resourcesDir && join(opts.resourcesDir, 'ffmpeg', exe),
    opts.appDir && join(opts.appDir, 'resources', 'ffmpeg', process.platform, exe)
  ].filter((p): p is string => !!p)
  for (const p of candidates) if (existsSync(p)) return p
  try {
    // The main process is CommonJS (require exists); tests run as ESM.
    const req = typeof require === 'function' ? require : createRequire(import.meta.url)
    const dev = req('ffmpeg-static') as string | null
    if (dev && existsSync(dev)) return dev
  } catch {
    // not installed (installed app)
  }
  return null
}

/** Preferred H.264 encoders: the OS's own (licensed with Windows/macOS, often hardware) first. */
const H264_PREFERENCE = ['h264_mf', 'h264_videotoolbox', 'libx264', 'h264_qsv', 'h264_amf', 'h264_nvenc', 'libopenh264']

export function pickH264Encoder(encodersOutput: string): string | null {
  const have = new Set(encodersOutput.split('\n').map((l) => l.trim().split(/\s+/)[1]).filter(Boolean))
  return H264_PREFERENCE.find((e) => have.has(e)) ?? null
}

/** Quality settings per encoder, aiming at ~4 Mbit/s for a 1080p-ish social clip. */
export function encoderArgs(encoder: string): string[] {
  if (encoder === 'libx264') return ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20']
  return ['-c:v', encoder, '-b:v', '4M']
}

export class Ffmpeg {
  private encoder?: Promise<string>

  constructor(readonly path: string) {}

  /** The best H.264 encoder this ffmpeg has (probed once). */
  h264(): Promise<string> {
    this.encoder ??= run(this.path, ['-hide_banner', '-encoders'], { windowsHide: true, maxBuffer: 4 * 1024 * 1024 }).then(({ stdout }) => {
      const e = pickH264Encoder(stdout)
      if (!e) throw new Error('This ffmpeg has no H.264 encoder.')
      return e
    })
    return this.encoder
  }

  /** Runs ffmpeg; rejects with the end of its log (the useful part) on failure or timeout. */
  run(args: string[], timeoutMs = 120_000): Promise<void> {
    return new Promise((resolve, reject) => {
      const p = spawn(this.path, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { windowsHide: true })
      let log = ''
      p.stderr.on('data', (d) => (log = (log + d).slice(-4000)))
      const t = setTimeout(() => p.kill('SIGKILL'), timeoutMs)
      p.on('error', (e) => (clearTimeout(t), reject(e)))
      p.on('close', (code) => {
        clearTimeout(t)
        if (code === 0) resolve()
        else reject(new Error(`ffmpeg failed (${code ?? 'killed'}): ${log.trim().split('\n').slice(-3).join(' | ')}`))
      })
    })
  }

  /**
   * A browser recording (WebM, variable frame rate) → MP4 every phone plays: H.264 + AAC, constant
   * 30 fps, at most 1080 px tall, cut at `maxSeconds`. `overlay` (a PNG, e.g. the trial band) is
   * stretched over the whole frame.
   */
  async webmToMp4(input: string, out: string, opts: { maxSeconds: number; overlay?: string }): Promise<void> {
    const encoder = await this.h264()
    const base = "scale=-2:'min(1080,ih)',fps=30,format=yuv420p"
    const video = opts.overlay
      ? ['-i', opts.overlay, '-filter_complex', `[0:v]${base}[v];[1:v][v]scale2ref=w=iw:h=ih[o][v2];[v2][o]overlay=0:0,format=yuv420p[out]`, '-map', '[out]', '-map', '0:a?']
      : ['-vf', base]
    await this.run(
      ['-i', input, ...video, '-t', String(opts.maxSeconds), ...encoderArgs(encoder), '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', out],
      Math.max(120_000, opts.maxSeconds * 10_000)
    )
  }

  /** A still from `atSeconds` in, for galleries and the QR page. */
  async posterFrame(video: string, out: string, atSeconds = 1): Promise<void> {
    await this.run(['-ss', String(atSeconds), '-i', video, '-frames:v', '1', '-q:v', '3', out])
  }

  /**
   * Animated GIF (e.g. a boomerang) → MP4 that Instagram and WhatsApp accept: played `loops` times,
   * even dimensions, yuv420p, fast start for streaming on the guest page.
   */
  async gifToMp4(gif: string, out: string, loops = 3): Promise<void> {
    const encoder = await this.h264()
    await this.run([
      '-stream_loop', String(loops - 1),
      '-i', gif,
      '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p',
      ...encoderArgs(encoder),
      '-an', '-movflags', '+faststart',
      out
    ])
  }
}
