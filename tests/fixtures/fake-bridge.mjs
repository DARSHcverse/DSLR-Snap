// Stands in for CanonBridge.exe so the JSON-lines protocol can be tested on any OS.
// Behaviour switches via argv: --no-camera, --hang-capture, --crash-on-capture, --auto-mode
import { createInterface } from 'node:readline'

const flags = new Set(process.argv.slice(2))
const out = (o) => process.stdout.write(JSON.stringify(o) + '\n')
let shots = 0
// Raw EDSDK codes, as the real bridge reports them. Mode 3 = M, 22 = Scene Intelligent Auto.
const manual = !flags.has('--auto-mode')
const exposure = {
  mode: manual ? 3 : 22,
  iso: { value: 0x58, allowed: manual ? [0x00, 0x48, 0x50, 0x58, 0x60] : [] },
  av: { value: 0x30, allowed: manual ? [0x2b, 0x2d, 0x30, 0x33, 0x35, 0x38] : [] },
  tv: { value: 0x70, allowed: manual ? [0x68, 0x6d, 0x70, 0x73, 0x75, 0x78, 0x80] : [] },
  wb: { value: 0, allowed: manual ? [0, 1, 5, 8] : [] }
}

createInterface({ input: process.stdin }).on('line', (line) => {
  const { id, cmd, args } = JSON.parse(line)
  switch (cmd) {
    case 'connect':
      if (flags.has('--no-camera')) return out({ id, ok: false, error: 'No Canon camera found.' })
      return out({ id, ok: true, data: { model: 'Canon EOS R100', liveView: true } })
    case 'capture':
      if (flags.has('--hang-capture')) return
      if (flags.has('--crash-on-capture')) process.exit(3)
      shots++
      out({ id, ok: true, data: { path: `${args.dir}/IMG_${shots}.JPG` } })
      if (shots === 2) out({ event: 'disconnected' })
      return
    case 'get_exposure':
      return out({ id, ok: true, data: exposure })
    case 'set_exposure': {
      const p = exposure[args.prop]
      if (!p || !p.allowed.includes(args.code)) return out({ id, ok: false, error: 'Camera refused this setting. Turn the mode dial to M.' })
      p.value = args.code
      out({ id, ok: true, data: exposure })
      return out({ event: 'exposure_changed' }) // the real camera reports its own property changes too
    }
    case 'liveview_frame':
      return out({ id, ok: true, data: { jpeg: Buffer.from('frame').toString('base64') } })
    case 'liveview_start':
    case 'liveview_stop':
    case 'disconnect':
      return out({ id, ok: true, data: {} })
    default:
      out({ id, ok: false, error: `Unknown command '${cmd}'` })
  }
})
