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
