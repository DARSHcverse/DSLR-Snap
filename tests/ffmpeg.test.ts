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

describe('360 edit', () => {
  it('plans the speed ramp: 30% normal, 45% slow motion, 25% normal', async () => {
    const { rampPlan } = await import('../src/main/video/ffmpeg')
    expect(rampPlan(10, 4)).toEqual({ slowFrom: 3, slowTo: 7.5, slow: 4, outSeconds: 3 + 18 + 2.5 })
  })
})

describe.skipIf(!path)('360 edit (ffmpeg)', () => {
  it('ramps, makes portrait 1080x1920, adds the overlay frame and music that fits the edit', async () => {
    const dir = mkdtempSync(join(tmpdir(), '360-'))
    const ff = new Ffmpeg(path!)
    // A 4 s, 120 fps landscape clip, like a GoPro 360 spin.
    await ff.run(['-f', 'lavfi', '-i', 'testsrc=size=1920x1080:rate=120', '-t', '4', '-c:v', 'libx264', '-preset', 'ultrafast', join(dir, 'spin.mp4')])
    await ff.run(['-f', 'lavfi', '-i', 'sine=frequency=330', '-t', '30', '-c:a', 'libmp3lame', join(dir, 'song.mp3')])
    const frame = join(dir, 'frame.png')
    await sharp({ create: { width: 1080, height: 1920, channels: 4, background: { r: 255, g: 122, b: 89, alpha: 0 } } })
      .composite([{ input: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920"><rect x="0" y="1700" width="1080" height="220" fill="#ff7a59"/></svg>') }])
      .png()
      .toFile(frame)

    const { seconds } = await ff.make360(join(dir, 'spin.mp4'), join(dir, 'out.mp4'), { slow: 4, overlays: [frame], music: join(dir, 'song.mp3') })
    expect(seconds).toBeCloseTo(9.4, 1)

    const info = await new Promise<string>((resolve) => {
      const p = require('node:child_process').spawn(path!, ['-hide_banner', '-i', join(dir, 'out.mp4')])
      let s = ''
      p.stderr.on('data', (d: Buffer) => (s += d))
      p.on('close', () => resolve(s))
    })
    expect(info).toMatch(/Video: h264.*1080x1920/)
    expect(info).toMatch(/Audio: aac/)
    expect(await ff.duration(join(dir, 'out.mp4'))).toBeGreaterThan(9)
    expect(await ff.duration(join(dir, 'out.mp4'))).toBeLessThan(9.8)
    // The overlay's orange band is burned into the bottom of the video.
    await ff.posterFrame(join(dir, 'out.mp4'), join(dir, 'still.jpg'), 2)
    const band = await sharp(join(dir, 'still.jpg')).extract({ left: 500, top: 1800, width: 40, height: 40 }).toBuffer()
    const [r, g, b] = (await sharp(band).stats()).channels.map((c) => c.mean)
    expect(r).toBeGreaterThan(200)
    expect(g).toBeGreaterThan(90)
    expect(b).toBeLessThan(130)
  }, 120_000)
})
