import { describe, expect, it } from 'vitest'
import { isPedalKey, keyLabel } from '../src/shared/trigger'

describe('foot pedal / clicker', () => {
  it('accepts the keys pedals and clickers usually send', () => {
    for (const code of ['Space', 'Enter', 'PageDown', 'ArrowRight']) expect(isPedalKey({ code }, 'auto')).toBe(true)
    expect(isPedalKey({ code: 'KeyB' }, 'auto')).toBe(false)
  })

  it('accepts only the learned key once one is set', () => {
    expect(isPedalKey({ code: 'KeyB' }, 'KeyB')).toBe(true)
    expect(isPedalKey({ code: 'Space' }, 'KeyB')).toBe(false)
  })

  it('never fires for shortcuts, held keys, or when off', () => {
    expect(isPedalKey({ code: 'Space', ctrlKey: true }, 'auto')).toBe(false)
    expect(isPedalKey({ code: 'Space', repeat: true }, 'auto')).toBe(false)
    expect(isPedalKey({ code: 'Space' }, 'off')).toBe(false)
  })

  it('names keys for the settings screen', () => {
    expect(keyLabel('KeyB')).toBe('B')
    expect(keyLabel('PageDown')).toBe('Page Down')
    expect(keyLabel('auto')).toBe('Common pedal keys')
  })
})
