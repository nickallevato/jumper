import { describe, it, expect } from 'vitest'
import { COSMETICS, cosmeticById, cosmeticIdForUnlock } from '../shared/cosmetics.js'

describe('cosmetics catalog', () => {
  it('cosmeticById is 1-based and falls back to default', () => {
    expect(cosmeticById(1)).toBe(COSMETICS[0])
    expect(cosmeticById(3)).toBe(COSMETICS[2])
    expect(cosmeticById(undefined).name).toBe('default')
    expect(cosmeticById(999).name).toBe('default')
  })

  it('cosmeticIdForUnlock maps a secret/area to its 1-based id', () => {
    expect(cosmeticIdForUnlock('secret_counterweight')).toBe(8)
    expect(cosmeticIdForUnlock('secret_wall_kick')).toBe(5)
    expect(cosmeticIdForUnlock('nope')).toBeNull()
  })
})
