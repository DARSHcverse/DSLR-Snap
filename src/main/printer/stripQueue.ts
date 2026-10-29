import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

/**
 * 2x6 strips need the DNP driver's "2inch cut" on, 4x6 prints need it off. Windows keeps such settings
 * per printer queue, so DSLR Snap adds a second queue for the same printer ("<name> (2x6 cut)", same
 * driver and USB port) with the cut on; choosePrinters() then sends strips there by its name.
 * Where the driver exposes the cut through Windows' print settings (PrintTicket) it's switched on
 * automatically; otherwise the operator ticks it once in that queue's Printing Preferences.
 */

const run = promisify(execFile)

export const stripQueueName = (base: string) => `${base} (2x6 cut)`

export interface CutOption {
  feature: string
  option: string
  /** The option that turns cutting off, for the 4x6 entry, when the driver names one. */
  off?: string
  /** The driver's own namespace the names use, which the ticket must declare. */
  namespace?: { prefix: string; uri: string }
}

const CUT_FEATURE = /cut/i
const OFF = /\b(off|none|no|disable|disabled|without)\b|nocut|no[\s_-]*cut/i
const TWO_INCH = /2\s*(inch|in\b|")|2x6|2\s*[x×]\s*6|strip/i
const ON = /\b(on|enable|enabled|yes|cut)\b/i

const displayName = (block: string) => block.match(/<psf:Property name="psk:DisplayName">\s*<psf:Value[^>]*>([^<]*)<\/psf:Value>/)?.[1] ?? ''

/** The driver's cut feature and the option that turns 2-inch cutting on, from its PrintCapabilities. */
export function findCutOption(capabilitiesXml: string): CutOption | null {
  for (const f of capabilitiesXml.matchAll(/<psf:Feature name="([^"]+)">([\s\S]*?)<\/psf:Feature>/g)) {
    const [, feature, body] = f
    const featureLabel = displayName(body.replace(/<psf:Option[\s\S]*?<\/psf:Option>/g, ''))
    if (!CUT_FEATURE.test(feature) && !CUT_FEATURE.test(featureLabel)) continue
    const options = [...body.matchAll(/<psf:Option name="([^"]+)"[^>]*>([\s\S]*?)<\/psf:Option>/g)].map(([, name, inner]) => ({ name, label: `${name} ${displayName(inner)}` }))
    const usable = options.filter((o) => !OFF.test(o.label))
    const pick = usable.find((o) => TWO_INCH.test(o.label)) ?? usable.find((o) => ON.test(o.label))
    if (!pick) continue
    const off = options.find((o) => OFF.test(o.label))?.name
    const prefix = feature.includes(':') ? feature.split(':')[0] : ''
    const uri = prefix ? capabilitiesXml.match(new RegExp(`xmlns:${prefix}="([^"]+)"`))?.[1] : undefined
    return { feature, option: pick.name, ...(off ? { off } : {}), ...(prefix && uri && !prefix.startsWith('ps') ? { namespace: { prefix, uri } } : {}) }
  }
  return null
}

/** A PrintTicket with the cut option selected, keeping every other setting. */
export function withOption(ticketXml: string, cut: CutOption): string {
  let xml = ticketXml
  if (cut.namespace && !xml.includes(`xmlns:${cut.namespace.prefix}=`)) {
    xml = xml.replace(/<psf:PrintTicket\b/, `<psf:PrintTicket xmlns:${cut.namespace.prefix}="${cut.namespace.uri}"`)
  }
  const selection = `<psf:Feature name="${cut.feature}"><psf:Option name="${cut.option}" /></psf:Feature>`
  const existing = new RegExp(`<psf:Feature name="${cut.feature.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}">[\\s\\S]*?</psf:Feature>`)
  return existing.test(xml) ? xml.replace(existing, selection) : xml.replace('</psf:PrintTicket>', `  ${selection}\n</psf:PrintTicket>`)
}

// ---------- Windows (PowerShell) ----------

/** PowerShell with values passed as environment variables, so printer names can't break out of a string. */
async function ps(script: string, env: Record<string, string>, timeout = 20_000): Promise<string> {
  const { stdout } = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script], {
    timeout,
    windowsHide: true,
    env: { ...process.env, ...env },
    maxBuffer: 20 * 1024 * 1024
  })
  return stdout
}

const INSPECT = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Printing
$p = Get-Printer -Name $env:DS_PRINTER
$caps = ''
try { $q = (New-Object System.Printing.LocalPrintServer).GetPrintQueue($env:DS_PRINTER); $caps = (New-Object System.IO.StreamReader($q.GetPrintCapabilitiesAsXml())).ReadToEnd() } catch {}
[pscustomobject]@{ driver = $p.DriverName; port = $p.PortName; ticket = (Get-PrintConfiguration -PrinterName $env:DS_PRINTER).PrintTicketXML; caps = $caps } | ConvertTo-Json -Compress`

interface QueueInfo {
  driver: string
  port: string
  ticket: string
  caps: string
}

const inspect = async (name: string): Promise<QueueInfo> => JSON.parse(await ps(INSPECT, { DS_PRINTER: name }))

/** PowerShell single-quoted literal (for the elevated run, which doesn't get our environment). */
const lit = (s: string) => `'${s.replace(/'/g, "''")}'`

async function addQueue(name: string, driver: string, port: string): Promise<void> {
  const add = `Add-Printer -Name ${lit(name)} -DriverName ${lit(driver)} -PortName ${lit(port)}`
  try {
    await ps(`$ErrorActionPreference = 'Stop'; ${add}`, {})
  } catch (e) {
    if (!/denied|privilege|0x80070005/i.test(String(e))) throw e
    // Adding a printer can need administrator rights: ask Windows once (a UAC prompt), then carry on.
    const encoded = Buffer.from(`$ErrorActionPreference = 'Stop'; ${add}`, 'utf16le').toString('base64')
    await ps(`Start-Process powershell.exe -Verb RunAs -Wait -WindowStyle Hidden -ArgumentList '-NoProfile','-EncodedCommand','${encoded}'`, {}, 120_000)
  }
}

export type StripSetup =
  | { status: 'done'; printer: string; fourBySixUncut: boolean } // cut switched on automatically (and off on the 4x6 entry when possible)
  | { status: 'manual'; printer: string } // created; the operator must tick "2inch cut" in its preferences

/** Adds "<base> (2x6 cut)" for the same printer and switches its cut on where the driver allows it. */
export async function setupStripQueue(base: string, installed: string[]): Promise<StripSetup> {
  if (process.platform !== 'win32') throw new Error('Printer setup runs on the Windows booth computer.')
  const name = stripQueueName(base)
  if (!installed.includes(name)) {
    const info = await inspect(base)
    if (!info.driver || !info.port) throw new Error(`Couldn't read how "${base}" is connected.`)
    await addQueue(name, info.driver, info.port)
  }
  const created = await inspect(name).catch(() => null)
  if (!created) throw new Error(`Windows didn't add "${name}". Allow the administrator prompt and try again.`)

  const cut = findCutOption(created.caps)
  if (!cut) return { status: 'manual', printer: name }
  try {
    await ps(`$ErrorActionPreference = 'Stop'; Set-PrintConfiguration -PrinterName $env:DS_PRINTER -PrintTicketXml $env:DS_TICKET`, {
      DS_PRINTER: name,
      DS_TICKET: withOption(created.ticket, cut)
    })
    const after = await inspect(name)
    if (!after.ticket.includes(`name="${cut.option}"`)) return { status: 'manual', printer: name }
    return { status: 'done', printer: name, fourBySixUncut: await cutOffOn(base, cut) }
  } catch {
    return { status: 'manual', printer: name }
  }
}

/** Makes sure the 4x6 entry doesn't cut (an operator may have switched it on there before). */
async function cutOffOn(base: string, cut: CutOption): Promise<boolean> {
  if (!cut.off) return false
  try {
    const info = await inspect(base)
    if (info.ticket.includes(`name="${cut.off}"`)) return true
    await ps(`$ErrorActionPreference = 'Stop'; Set-PrintConfiguration -PrinterName $env:DS_PRINTER -PrintTicketXml $env:DS_TICKET`, {
      DS_PRINTER: base,
      DS_TICKET: withOption(info.ticket, { ...cut, option: cut.off })
    })
    return (await inspect(base)).ticket.includes(`name="${cut.off}"`)
  } catch {
    return false
  }
}
