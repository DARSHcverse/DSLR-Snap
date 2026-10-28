import { describe, expect, it } from 'vitest'
import { preferencesTarget, printerPreferencesCommand } from '../src/main/printer/printerPreferences'

describe('printer preferences (2-inch cut)', () => {
  it("opens Windows' Printing Preferences for that printer, name as a single argument", () => {
    expect(printerPreferencesCommand('DS-RX1 (2x6 cut)')).toEqual({ file: 'rundll32.exe', args: ['printui.dll,PrintUIEntry', '/e', '/n', 'DS-RX1 (2x6 cut)'] })
    // A hostile name stays one argument (no shell), so it can't chain commands.
    expect(printerPreferencesCommand('x" & calc & "').args.at(-1)).toBe('x" & calc & "')
    expect(() => printerPreferencesCommand('  ')).toThrow()
  })

  it('with two printer entries, opens the right one per format', () => {
    const two = { queue4x6: 'DS-RX1', queue2x6: 'DS-RX1 (2x6 cut)' }
    expect(preferencesTarget(two, '2x6')).toEqual({ printer: 'DS-RX1 (2x6 cut)', cut: 'on', sharedQueue: false })
    expect(preferencesTarget(two, '4x6')).toEqual({ printer: 'DS-RX1', cut: 'off', sharedQueue: false })
  })

  it('with one printer entry, opens it and says which way to set the cut for the format', () => {
    expect(preferencesTarget({ queue4x6: 'DS-RX1', queue2x6: 'DS-RX1' }, '2x6')).toEqual({ printer: 'DS-RX1', cut: 'on', sharedQueue: true })
    expect(preferencesTarget({ queue4x6: 'DS-RX1' }, '4x6')).toEqual({ printer: 'DS-RX1', cut: 'off', sharedQueue: true })
  })

  it('has nothing to open when no DNP printer is found', () => {
    expect(preferencesTarget({}, '2x6')).toBeNull()
  })
})
