import { describe, expect, it } from 'vitest'
import { distribute } from './distribution'
import { seededRng } from './rng'

const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0)

const BANK_300 = { Prepare: 80, Model: 80, Visualize: 80, Manage: 60 } // the 300-question layout from the brief
const BANK_50 = { Prepare: 13, Model: 15, Visualize: 15, Manage: 7 } // the bundled bank

describe('distribute', () => {
  it('splits 300-style weights evenly when divisible', () => {
    expect(distribute(30, BANK_300)).toEqual({ Prepare: 8, Model: 8, Visualize: 8, Manage: 6 })
    expect(distribute(300, BANK_300)).toEqual(BANK_300)
  })

  it('handles the small counts 5 and 7', () => {
    const five = distribute(5, BANK_300)
    const seven = distribute(7, BANK_300)
    expect(sum(five)).toBe(5)
    expect(sum(seven)).toBe(7)
    // quotas 1.33 / 1.33 / 1.33 / 1.0 -> floors sum to 4, the spare seat goes to the first of the tied 1.33s
    expect(five).toEqual({ Prepare: 2, Model: 1, Visualize: 1, Manage: 1 })
  })

  it('returns the whole pool for the maximum and clamps larger requests', () => {
    expect(distribute(50, BANK_50)).toEqual(BANK_50)
    expect(distribute(9999, BANK_50)).toEqual(BANK_50)
  })

  it('single domain gets everything requested', () => {
    expect(distribute(17, { Model: 15 })).toEqual({ Model: 15 })
    expect(distribute(9, { Model: 15 })).toEqual({ Model: 9 })
  })

  it('returns zeros for 0, negative or empty input', () => {
    expect(distribute(0, BANK_50)).toEqual({ Prepare: 0, Model: 0, Visualize: 0, Manage: 0 })
    expect(distribute(-4, BANK_50)).toEqual({ Prepare: 0, Model: 0, Visualize: 0, Manage: 0 })
    expect(distribute(5, {})).toEqual({})
    expect(distribute(5, { A: 0, B: 0 })).toEqual({ A: 0, B: 0 })
  })

  it('is deterministic on ties', () => {
    expect(distribute(1, { A: 10, B: 10 })).toEqual({ A: 1, B: 0 })
    expect(distribute(1, { A: 10, B: 11 })).toEqual({ A: 0, B: 1 })
  })

  it('every request on both banks sums exactly and respects availability and floor/ceil quotas', () => {
    for (const bank of [BANK_300, BANK_50]) {
      const keys = Object.keys(bank)
      const total = sum(bank)
      // every non-empty subset of domains
      for (let mask = 1; mask < 1 << keys.length; mask++) {
        const pool = Object.fromEntries(keys.filter((_, i) => mask & (1 << i)).map((k) => [k, bank[k as keyof typeof bank]]))
        const poolTotal = sum(pool)
        for (let n = 0; n <= poolTotal; n++) {
          const out = distribute(n, pool)
          expect(sum(out)).toBe(n)
          for (const [k, avail] of Object.entries(pool)) {
            expect(out[k]).toBeGreaterThanOrEqual(0)
            expect(out[k]).toBeLessThanOrEqual(avail)
            const quota = (n * avail) / poolTotal
            expect(out[k]).toBeGreaterThanOrEqual(Math.floor(quota))
            expect(out[k]).toBeLessThanOrEqual(Math.ceil(quota))
          }
        }
      }
      expect(total).toBeGreaterThan(0)
    }
  })

  it('holds for random pools', () => {
    const rng = seededRng(42)
    for (let round = 0; round < 500; round++) {
      const domains = 1 + Math.floor(rng() * 6)
      const pool: Record<string, number> = {}
      for (let i = 0; i < domains; i++) pool[`D${i}`] = Math.floor(rng() * 120)
      const total = sum(pool)
      const n = Math.floor(rng() * (total + 20))
      const out = distribute(n, pool)
      expect(sum(out)).toBe(Math.min(n, total))
      for (const [k, avail] of Object.entries(pool)) expect(out[k]).toBeLessThanOrEqual(avail)
    }
  })
})
