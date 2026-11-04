import { describe, expect, it } from 'vitest'
import { packageState, printsToMake } from '../src/shared/printLimit'

describe('print packages', () => {
  it('no limit prints every copy', () => {
    expect(printsToMake(0, 999, 2)).toBe(2)
  })
  it('prints only what is left of the package, then none', () => {
    expect(printsToMake(200, 197, 2)).toBe(2)
    expect(printsToMake(200, 199, 2)).toBe(1)
    expect(printsToMake(200, 200, 2)).toBe(0)
    expect(printsToMake(200, 230, 1)).toBe(0)
  })
  it('is "near" in the last 10% (at least the last 5 prints), then "done"', () => {
    expect(packageState(200, 179)).toBe('ok')
    expect(packageState(200, 180)).toBe('near')
    expect(packageState(200, 200)).toBe('done')
    expect(packageState(20, 15)).toBe('near')
    expect(packageState(20, 14)).toBe('ok')
    expect(packageState(0, 5000)).toBe('ok')
  })
})
