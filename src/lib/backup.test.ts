import { describe, expect, it } from 'vitest'
import type { Attempt } from '../types'
import { buildBackup, mergeBackup, parseBackup } from './backup'

const attempt = (id: string, finishedAt: number): Attempt => ({
  id,
  finishedAt,
  mode: 'practice',
  label: null,
  total: 2,
  answered: 2,
  correct: 1,
  unanswered: 0,
  percent: 50,
  scaled: 500,
  passed: false,
  durationMs: 1000,
  timeLimitMs: null,
  domains: { 'Model the data': { total: 2, correct: 1 } },
  results: [
    { id: 's1q01', selected: ['D'], answered: true, correct: true, flagged: false },
    { id: 's1q02', selected: ['A'], answered: true, correct: false, flagged: false },
  ],
  optionOrder: {},
})

const stat = (attempts: number, correct: number, lastAt: number) => ({ attempts, correct, lastCorrect: correct > 0, lastAt })

describe('backup file', () => {
  it('round-trips through JSON', () => {
    const b = buildBackup([attempt('a', 10)], { s1q01: stat(1, 1, 10) })
    const parsed = parseBackup(JSON.stringify(b))
    expect(parsed?.history).toHaveLength(1)
    expect(parsed?.stats.s1q01.correct).toBe(1)
  })

  it('rejects files that are not a backup of this app', () => {
    expect(parseBackup('not json')).toBeNull()
    expect(parseBackup('{}')).toBeNull()
    expect(parseBackup(JSON.stringify({ app: 'other', history: [], stats: {} }))).toBeNull()
    expect(parseBackup(JSON.stringify({ app: 'pl300-practice', history: 'x', stats: {} }))).toBeNull()
  })

  it('drops malformed attempts and stats but keeps valid ones', () => {
    const text = JSON.stringify({
      app: 'pl300-practice',
      history: [attempt('ok', 1), { id: 'bad' }, null],
      stats: { good: stat(1, 1, 1), bad: { attempts: 'x' } },
    })
    const parsed = parseBackup(text)!
    expect(parsed.history.map((a) => a.id)).toEqual(['ok'])
    expect(Object.keys(parsed.stats)).toEqual(['good'])
  })
})

describe('mergeBackup', () => {
  it('unites attempts by id, newest first, without duplicates', () => {
    const merged = mergeBackup(
      { history: [attempt('a', 30), attempt('b', 10)], stats: {} },
      { history: [attempt('b', 10), attempt('c', 20)], stats: {} },
    )
    expect(merged.history.map((a) => a.id)).toEqual(['a', 'c', 'b'])
    expect(merged.addedAttempts).toBe(1)
  })

  it('keeps the statistic with the most recent answer per question', () => {
    const merged = mergeBackup(
      { history: [], stats: { q1: stat(3, 1, 100), q2: stat(1, 1, 50) } },
      { history: [], stats: { q1: stat(1, 0, 200), q2: stat(5, 5, 10), q3: stat(2, 2, 5) } },
    )
    expect(merged.stats.q1.lastAt).toBe(200)
    expect(merged.stats.q2.attempts).toBe(1)
    expect(merged.stats.q3.attempts).toBe(2)
  })

  it('caps the history at 100 attempts', () => {
    const many = Array.from({ length: 120 }, (_, i) => attempt(`x${i}`, i))
    expect(mergeBackup({ history: [], stats: {} }, { history: many, stats: {} }).history).toHaveLength(100)
  })

  it('importing the same backup twice changes nothing', () => {
    const data = { history: [attempt('a', 1)], stats: { q1: stat(1, 1, 1) } }
    const once = mergeBackup({ history: [], stats: {} }, data)
    const twice = mergeBackup(once, data)
    expect(twice.history).toEqual(once.history)
    expect(twice.addedAttempts).toBe(0)
  })
})
