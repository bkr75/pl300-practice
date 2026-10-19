import { describe, expect, it } from 'vitest'
import { bank } from '../data/bank'
import type { Bank, Question, QuizConfig } from '../types'
import { seededRng } from './rng'
import { candidatePool, clusterCases, countMissed, createSession, pickQuestions, weakPriority, weakTier } from './select'

const base: QuizConfig = {
  mode: 'practice',
  source: 'standard',
  domains: bank.domains,
  count: 10,
  shuffleQuestions: true,
  shuffleOptions: true,
  timerEnabled: false,
  secondsPerQuestion: 100,
  includeCases: true,
}
const ctx = { stats: {}, lastAttempt: null }

const countBy = (qs: Question[]) => {
  const out: Record<string, number> = {}
  for (const q of qs) out[q.domain] = (out[q.domain] ?? 0) + 1
  return out
}

describe('pickQuestions on the bundled bank', () => {
  it('returns exactly the requested count for every N from 1 to the max, without duplicates', () => {
    const total = bank.questions.length
    for (let n = 1; n <= total; n++) {
      const picked = pickQuestions(bank, { ...base, count: n }, ctx, seededRng(n))
      expect(picked).toHaveLength(n)
      expect(new Set(picked.map((q) => q.id)).size).toBe(n)
    }
  })

  it('distributes proportionally across all domains', () => {
    const picked = pickQuestions(bank, { ...base, count: 20 }, ctx, seededRng(1))
    const counts = countBy(picked)
    const avail = countBy(bank.questions)
    for (const d of bank.domains) {
      const quota = (20 * avail[d]) / bank.questions.length
      expect(counts[d]).toBeGreaterThanOrEqual(Math.floor(quota))
      expect(counts[d]).toBeLessThanOrEqual(Math.ceil(quota))
    }
  })

  it('splits 30 questions 8/8/8/6 and 300 questions 80/80/80/60 on the real bank', () => {
    expect(countBy(pickQuestions(bank, { ...base, count: 30 }, ctx, seededRng(1)))).toEqual({
      'Prepare the data': 8,
      'Model the data': 8,
      'Visualize and analyze the data': 8,
      'Manage and secure Power BI': 6,
    })
    expect(countBy(pickQuestions(bank, { ...base, count: 300 }, ctx, seededRng(1)))).toEqual({
      'Prepare the data': 80,
      'Model the data': 80,
      'Visualize and analyze the data': 80,
      'Manage and secure Power BI': 60,
    })
  })

  it('keeps each real case study together when shuffling the full bank, or drops them all on request', () => {
    const all = pickQuestions(bank, { ...base, count: 300 }, ctx, seededRng(7))
    for (const c of bank.cases) {
      const idx = all.map((q, i) => (q.caseId === c.id ? i : -1)).filter((i) => i >= 0)
      expect(idx).toHaveLength(5)
      expect(idx[4] - idx[0]).toBe(4)
    }
    const noCases = pickQuestions(bank, { ...base, count: 300, includeCases: false }, ctx, seededRng(7))
    expect(noCases).toHaveLength(275)
    expect(noCases.every((q) => q.caseId === null)).toBe(true)
  })

  it('stays inside a single selected domain', () => {
    const domain = bank.domains[1]
    const max = bank.questions.filter((q) => q.domain === domain).length
    const picked = pickQuestions(bank, { ...base, domains: [domain], count: max + 50 }, ctx, seededRng(3))
    expect(picked).toHaveLength(max)
    expect(picked.every((q) => q.domain === domain)).toBe(true)
  })

  it('works for two domains with small counts (5 and 7)', () => {
    const domains = [bank.domains[0], bank.domains[3]]
    for (const n of [5, 7]) {
      const picked = pickQuestions(bank, { ...base, domains, count: n }, ctx, seededRng(n))
      expect(picked).toHaveLength(n)
      expect(picked.every((q) => domains.includes(q.domain))).toBe(true)
    }
  })

  it('keeps bank order when not shuffling', () => {
    const picked = pickQuestions(bank, { ...base, shuffleQuestions: false, count: 12 }, ctx, seededRng(9))
    expect(picked.map((q) => q.number)).toEqual([...picked.map((q) => q.number)].sort((a, b) => a - b))
  })

  it('different seeds give different selections', () => {
    const a = pickQuestions(bank, { ...base, count: 10 }, ctx, seededRng(1)).map((q) => q.id)
    const b = pickQuestions(bank, { ...base, count: 10 }, ctx, seededRng(2)).map((q) => q.id)
    expect(a).not.toEqual(b)
  })
})

describe('sources', () => {
  it('"wrong" only offers questions missed in the last attempt', () => {
    const lastAttempt = {
      results: [
        { id: bank.questions[0].id, selected: ['A'], answered: true, correct: false, flagged: false },
        { id: bank.questions[1].id, selected: ['A'], answered: true, correct: true, flagged: false },
        { id: bank.questions[2].id, selected: [], answered: false, correct: false, flagged: false },
      ],
    } as never
    const cfg: QuizConfig = { ...base, source: 'wrong', count: 99 }
    const pool = candidatePool(bank, cfg, { stats: {}, lastAttempt })
    expect(pool.map((q) => q.id).sort()).toEqual([bank.questions[0].id, bank.questions[2].id].sort())
    expect(pickQuestions(bank, cfg, { stats: {}, lastAttempt }, seededRng(1))).toHaveLength(2)
  })

  describe('"weak" source', () => {
    const stat = (attempts: number, correct: number, lastCorrect = correct > 0) => ({ attempts, correct, lastCorrect, lastAt: 1 })
    const idsOf = (qs: Question[]) => qs.map((q) => q.id)
    // first 30 questions: missed (worst first = lower index); next 40: always correct; the rest: never answered
    const missedIds = bank.questions.slice(0, 30).map((q) => q.id)
    const masteredIds = bank.questions.slice(30, 70).map((q) => q.id)
    const stats = Object.fromEntries([
      ...missedIds.map((id, i) => [id, i < 10 ? stat(4, 0) : stat(4, 2, false)]), // 10 at 100% miss rate, 20 at 50%
      ...masteredIds.map((id) => [id, stat(3, 3)]),
    ])
    const weak = (count: number, seed: number) =>
      pickQuestions(bank, { ...base, source: 'weak', count, shuffleQuestions: false }, { stats, lastAttempt: null }, seededRng(seed))

    it('returns only missed questions while there are enough of them', () => {
      for (let seed = 1; seed <= 20; seed++) {
        expect(idsOf(weak(10, seed)).every((id) => missedIds.includes(id))).toBe(true)
        expect(idsOf(weak(30, seed)).sort()).toEqual([...missedIds].sort())
      }
    })

    it('takes the worst miss rate first', () => {
      for (let seed = 1; seed <= 20; seed++) {
        // 10 questions with a 100% miss rate exist, so a quiz of 10 must be exactly those
        expect(idsOf(weak(10, seed)).sort()).toEqual(missedIds.slice(0, 10).sort())
      }
    })

    it('fills the rest with never-answered questions before always-correct ones', () => {
      const picked = idsOf(weak(100, 3))
      expect(picked).toHaveLength(100)
      expect(missedIds.every((id) => picked.includes(id))).toBe(true)
      expect(masteredIds.some((id) => picked.includes(id))).toBe(false) // 230 unseen questions come first
      expect(idsOf(weak(300, 3)).filter((id) => masteredIds.includes(id))).toHaveLength(40) // ...but they are used last
    })

    it('puts questions whose last answer was wrong ahead of equal miss rates', () => {
      const tie = { a: stat(2, 1, false), b: stat(2, 1, true) }
      const pool = [bank.questions[0], bank.questions[1]]
      const order = weakPriority(pool, { [pool[0].id]: tie.b, [pool[1].id]: tie.a }, seededRng(1))
      expect(order[0].id).toBe(pool[1].id)
    })

    it('shuffles within a group so repeats are not always the same questions', () => {
      expect(idsOf(weak(5, 1))).not.toEqual(idsOf(weak(5, 2)))
    })

    it('classifies tiers and counts missed questions', () => {
      expect(weakTier(undefined)).toBe(1)
      expect(weakTier(stat(0, 0))).toBe(1)
      expect(weakTier(stat(3, 2))).toBe(0)
      expect(weakTier(stat(3, 3))).toBe(2)
      expect(countMissed(bank.questions, stats)).toBe(30)
    })
  })
})

describe('case studies', () => {
  const mkQ = (id: string, caseId: string | null, domain = 'D'): Question => ({
    id,
    number: Number(id.slice(1)),
    domain,
    topic: 't',
    type: 'single',
    caseId,
    stem: id,
    code: null,
    options: [
      { key: 'A', text: 'a', explanation: null },
      { key: 'B', text: 'b', explanation: null },
    ],
    correct: ['A'],
    explanation: 'e',
    reference: null,
  })

  it('clusterCases keeps each case together at its first position', () => {
    const qs = [mkQ('q1', 'c1'), mkQ('q2', null), mkQ('q3', 'c2'), mkQ('q4', 'c1'), mkQ('q5', 'c2'), mkQ('q6', null)]
    expect(clusterCases(qs).map((q) => q.id)).toEqual(['q1', 'q4', 'q2', 'q3', 'q5', 'q6'])
  })

  it('pickQuestions can exclude case questions and keeps the rest together', () => {
    const questions = [
      ...Array.from({ length: 6 }, (_, i) => mkQ(`q${i + 1}`, 'c1')),
      ...Array.from({ length: 6 }, (_, i) => mkQ(`q${i + 7}`, null)),
    ]
    const b: Bank = { domains: ['D'], cases: [{ id: 'c1', title: 'Case', text: 'text' }], questions }
    const cfg: QuizConfig = { ...base, domains: ['D'], count: 12 }
    const without = pickQuestions(b, { ...cfg, includeCases: false }, ctx, seededRng(1))
    expect(without).toHaveLength(6)
    expect(without.every((q) => q.caseId === null)).toBe(true)

    const withCases = pickQuestions(b, cfg, ctx, seededRng(4)).map((q) => q.caseId)
    const first = withCases.indexOf('c1')
    const last = withCases.lastIndexOf('c1')
    expect(withCases.slice(first, last + 1).every((c) => c === 'c1')).toBe(true)
  })
})

describe('createSession', () => {
  it('shuffles options only when asked and always keeps every key', () => {
    const qs = bank.questions.slice(0, 8)
    const plain = createSession(qs, { ...base, shuffleOptions: false })
    for (const q of qs) expect(plain.optionOrder[q.id]).toEqual(q.options.map((o) => o.key))
    const mixed = createSession(qs, { ...base, shuffleOptions: true }, { rng: seededRng(11) })
    for (const q of qs) expect([...mixed.optionOrder[q.id]].sort()).toEqual(q.options.map((o) => o.key).sort())
    expect(qs.some((q) => mixed.optionOrder[q.id].join() !== q.options.map((o) => o.key).join())).toBe(true)
    expect(mixed.questionIds).toEqual(qs.map((q) => q.id))
  })
})
