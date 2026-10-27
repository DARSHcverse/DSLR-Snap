import { execFile } from 'node:child_process'
import { hostname } from 'node:os'
import { promisify } from 'node:util'
import { hashMachineId } from './licence'

const run = promisify(execFile)

/**
 * A stable id for this computer, hashed. Windows: MachineGuid (survives app reinstalls, changes on
 * a Windows reinstall). macOS: the hardware UUID. Falls back to the hostname.
 */
export async function machineHash(): Promise<string> {
  try {
    if (process.platform === 'win32') {
      const { stdout } = await run('reg', ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid'], { windowsHide: true })
      const m = stdout.match(/MachineGuid\s+REG_SZ\s+(\S+)/)
      if (m) return hashMachineId(m[1])
    } else if (process.platform === 'darwin') {
      const { stdout } = await run('ioreg', ['-rd1', '-c', 'IOPlatformExpertDevice'])
      const m = stdout.match(/"IOPlatformUUID"\s*=\s*"([^"]+)"/)
      if (m) return hashMachineId(m[1])
    }
  } catch {
    // fall through
  }
  return hashMachineId(`host:${hostname()}`)
}
