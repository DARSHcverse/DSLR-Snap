import { sanitizeTemplate } from './templateEdit'
import type { Template } from './types'

/**
 * A booth computer's setup, saved to the account so another computer can copy it: the operator's
 * own templates, booth lock and pedal key, and (only if they choose) the operator PIN's hash.
 * Camera and printer choices, webcams and the photos folder belong to each computer and stay put.
 * Template artwork travels separately (one PNG per template, through the website's storage).
 */
export const SETUP_VERSION = 1

export type SetupTemplate = Omit<Template, 'overlayPath' | 'backgroundPath' | 'logo'> & {
  /** The design's PNG: drawn over the photos, under them, or none (a drawn template). */
  artwork?: 'over' | 'under'
}

export interface BoothSetup {
  version: typeof SETUP_VERSION
  savedFrom: string
  savedAt: string
  templates: SetupTemplate[]
  prefs: { kioskLock: boolean; pedalKey: string }
  pinHash?: string
}

export const MAX_SETUP_TEMPLATES = 50
const TEMPLATE_ID = /^(imported-[0-9a-f]{8}|[a-z0-9-]+-copy-[0-9a-f]{6})$/
const PIN_HASH = /^[0-9a-f]{32}:[0-9a-f]{64}$/
const PEDAL = /^(auto|off|[A-Za-z0-9]{1,24})$/

function setupTemplate(t: Template, artwork: unknown): SetupTemplate {
  const { overlayPath: _o, backgroundPath: _b, logo: _l, ...clean } = sanitizeTemplate(t)
  return { ...clean, ...(artwork === 'over' || artwork === 'under' ? { artwork } : {}) }
}

export function buildSetup(o: {
  templates: Template[]
  builtInIds: Set<string>
  prefs: { kioskLock: boolean; pedalKey: string }
  pinHash?: string
  includePin: boolean
  from: string
  now?: Date
}): BoothSetup {
  return {
    version: SETUP_VERSION,
    savedFrom: o.from.slice(0, 64),
    savedAt: (o.now ?? new Date()).toISOString(),
    templates: o.templates
      .filter((t) => !o.builtInIds.has(t.id) && TEMPLATE_ID.test(t.id))
      .slice(0, MAX_SETUP_TEMPLATES)
      .map((t) => setupTemplate(t, t.overlayPath ? 'over' : t.backgroundPath ? 'under' : undefined)),
    prefs: { kioskLock: o.prefs.kioskLock, pedalKey: PEDAL.test(o.prefs.pedalKey) ? o.prefs.pedalKey : 'auto' },
    ...(o.includePin && o.pinHash && PIN_HASH.test(o.pinHash) ? { pinHash: o.pinHash } : {})
  }
}

/** A setup from the website, checked again: nothing in it is trusted. Null when it isn't one. */
export function readSetup(raw: unknown): BoothSetup | null {
  if (!raw || typeof raw !== 'object') return null
  const s = raw as Record<string, unknown>
  if (s.version !== SETUP_VERSION || !Array.isArray(s.templates)) return null
  const seen = new Set<string>()
  const templates: SetupTemplate[] = []
  for (const t of s.templates.slice(0, MAX_SETUP_TEMPLATES) as Record<string, unknown>[]) {
    if (!t || typeof t.id !== 'string' || !TEMPLATE_ID.test(t.id) || seen.has(t.id)) continue
    try {
      templates.push(setupTemplate(t as unknown as Template, t.artwork))
      seen.add(t.id)
    } catch {
      // unknown layout: skip it
    }
  }
  const prefs = (s.prefs ?? {}) as Record<string, unknown>
  return {
    version: SETUP_VERSION,
    savedFrom: typeof s.savedFrom === 'string' ? s.savedFrom.slice(0, 64) : 'another computer',
    savedAt: typeof s.savedAt === 'string' && !Number.isNaN(Date.parse(s.savedAt)) ? s.savedAt : new Date(0).toISOString(),
    templates,
    prefs: {
      kioskLock: typeof prefs.kioskLock === 'boolean' ? prefs.kioskLock : true,
      pedalKey: typeof prefs.pedalKey === 'string' && PEDAL.test(prefs.pedalKey) ? prefs.pedalKey : 'auto'
    },
    ...(typeof s.pinHash === 'string' && PIN_HASH.test(s.pinHash) ? { pinHash: s.pinHash } : {})
  }
}
