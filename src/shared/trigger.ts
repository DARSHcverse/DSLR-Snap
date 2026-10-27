/**
 * Hands-free start: USB foot pedals and Bluetooth clickers act as a keyboard and send one key.
 * 'auto' accepts the keys they usually send; a learned key (KeyboardEvent.code) accepts only that;
 * 'off' ignores keys.
 */
export const PEDAL_AUTO_KEYS = ['Space', 'Enter', 'NumpadEnter', 'PageDown', 'PageUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp']

export function isPedalKey(e: { code: string; ctrlKey?: boolean; altKey?: boolean; metaKey?: boolean; repeat?: boolean }, setting: string): boolean {
  if (setting === 'off' || e.repeat || e.ctrlKey || e.altKey || e.metaKey) return false // shortcuts (e.g. Ctrl+Shift+A) are never a pedal
  return setting === 'auto' ? PEDAL_AUTO_KEYS.includes(e.code) : e.code === setting
}

/** Readable name of a key code for the settings screen ("KeyB" → "B", "PageDown" → "Page Down"). */
export function keyLabel(code: string): string {
  if (code === 'auto') return 'Common pedal keys'
  if (code === 'off') return 'Off'
  return code.replace(/^Key|^Digit/, '').replace(/([a-z])([A-Z])/g, '$1 $2')
}
