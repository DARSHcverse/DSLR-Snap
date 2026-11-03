import { describe, expect, it } from 'vitest'
import { fromScreen } from '../src/main/deviceSettings'
import { DEFAULT_DEVICE_SETTINGS } from '../src/main/db/database'

describe('saving device settings from the Printer & devices screen', () => {
  it("keeps the camera presets as stored, even when the screen's copy is out of date", () => {
    const stored = { ...DEFAULT_DEVICE_SETTINGS, cameraPresets: [{ id: 'a', name: 'Synced from the other booth', settings: { iso: '400' } }] }
    const fromAnOldScreen = { ...DEFAULT_DEVICE_SETTINGS, pedalKey: 'KeyB', cameraPresets: [] }
    const saved = fromScreen(stored, fromAnOldScreen)
    expect(saved.pedalKey).toBe('KeyB')
    expect(saved.cameraPresets).toEqual(stored.cameraPresets)
  })
})
