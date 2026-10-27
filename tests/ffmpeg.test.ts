import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { makeBoomerang } from '../src/main/BoothService'
import { encoderArgs, Ffmpeg, locateFfmpeg, pickH264Encoder } from '../src/main/video/ffmpeg'

const ENCODERS = ` V....D libx264              libx264 H.264
 V....D h264_videotoolbox    VideoToolbox H.264 Encoder
 V....D h264_mf              H264 via MediaFoundation
 A....D aac                  AAC`

describe('encoder choice', () => {
  it("prefers the OS's own H.264 encoder", () => {
    expect(pickH264Encoder(ENCODERS)).toBe('h264_mf')
    expect(pickH264Encoder(ENCODERS.replace(/.*h264_mf.*\n/, ''))).toBe('h264_videotoolbox')
    expect(pickH264Encoder(' A....D aac  AAC')).toBeNull()
  })

  it('uses quality-based settings for x264, bitrate for hardware encoders', () => {
    expect(encoderArgs('libx264')).toContain('-crf')
    expect(encoderArgs('h264_mf')).toEqual(['-c:v', 'h264_mf', '-b:v', '4M'])
  })
})

const path = locateFfmpeg({ appDir: join(__dirname, '..') })
describe.skipIf(!path)('ffmpeg', () => {
  it('turns a boomerang GIF into a looping MP4 for social media', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ff-'))
    const frames = await Promise.all(
      ['#ff6b6b', '#4ecdc4', '#ffd166', '#6a4c93'].map((c) => sharp({ create: { width: 961, height: 641, channels: 3, background: c } }).jpeg().toBuffer())
    )
    await makeBoomerang(frames, join(dir, 'b.gif'))
    const ff = new Ffmpeg(path!)
    await ff.gifToMp4(join(dir, 'b.gif'), join(dir, 'b.mp4'))
    const { stat } = await import('node:fs/promises')
    expect((await stat(join(dir, 'b.mp4'))).size).toBeGreaterThan(1000)
  })

  it('reports what went wrong', async () => {
    await expect(new Ffmpeg(path!).run(['-i', '/nonexistent.gif', '/tmp/x.mp4'])).rejects.toThrow(/ffmpeg failed/)
  })
})

describe.skipIf(!path)('video guestbook conversion', () => {
  it('turns a browser WebM recording into a phone-friendly MP4 with sound, cut at the limit, plus a poster', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'vid-'))
    const ff = new Ffmpeg(path!)
    // A 4 s 1280x720 WebM with audio, like MediaRecorder makes.
    await ff.run(['-f', 'lavfi', '-i', 'testsrc=size=1280x720:rate=24', '-f', 'lavfi', '-i', 'sine=frequency=440', '-t', '4', '-c:v', 'libvpx', '-b:v', '1M', '-c:a', 'libopus', join(dir, 'rec.webm')])
    const band = join(dir, 'band.png')
    await sharp({ create: { width: 1280, height: 720, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0.4 } } }).png().toFile(band)

    await ff.webmToMp4(join(dir, 'rec.webm'), join(dir, 'out.mp4'), { maxSeconds: 3, overlay: band })
    await ff.posterFrame(join(dir, 'out.mp4'), join(dir, 'poster.jpg'))

    const info = await new Promise<string>((resolve) => {
      const p = require('node:child_process').spawn(path!, ['-hide_banner', '-i', join(dir, 'out.mp4')])
      let s = ''
      p.stderr.on('data', (d: Buffer) => (s += d))
      p.on('close', () => resolve(s))
    })
    expect(info).toMatch(/Video: h264/)
    expect(info).toMatch(/yuv420p/)
    expect(info).toMatch(/Audio: aac/)
    const secs = Number(/Duration: 00:00:(\d+\.\d+)/.exec(info)?.[1])
    expect(secs).toBeGreaterThan(2.5)
    expect(secs).toBeLessThan(3.5)
    expect((await sharp(join(dir, 'poster.jpg')).metadata()).width).toBe(1280)
  }, 60_000)
})
