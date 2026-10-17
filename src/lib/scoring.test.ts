import { describe, expect, it } from 'vitest'
import type { Question, QuizConfig, Session } from '../types'
import {
  applyAttemptToStats,
  domainAccuracy,
  estimateScaledScore,
  gradeQuestion,
  isCorrect,
  scoreSession,
  summarize,
  weakTopics,
} from './scoring'

const mk = (id: string, domain: string, topic: string, correct: string[], type: 'single' | 'multi' = 'single'): Question => ({
  id,
  number: Number(id.slice(1)),
  domain,
  topic,
  type,
  caseId: null,
  stem: id,
  code: null,
  options: ['A', 'B', 'C', 'D'].map((key) => ({ key, text: key, explanation: null })),
  correct,
  explanation: 'because',
  reference: null,
})

const Q = [
  mk('q1', 'Model', 'DAX', ['B']),
  mk('q2', 'Model', 'DAX', ['A', 'C'], 'multi'),
  mk('q3', 'Prepare', 'Power Query', ['D']),
  mk('q4', 'Manage', 'RLS', ['A']),
]
const byId = new Map(Q.map((q) => [q.id, q]))

const config: QuizConfig = {
  mode: 'exam',
  source: 'standard',
  domains: ['Model', 'Prepare', 'Manage'],
  count: 4,
  shuffleQuestions: false,
  shuffleOptions: false,
  timerEnabled: true,
  secondsPerQuestion: 100,
  includeCases: true,
}

const session = (answers: Session['answers'], flagged: Session['flagged'] = {}): Session => ({
  id: 's1',
  startedAt: 0,
  config,
  label: null,
  questionIds: Q.map((q) => q.id),
  optionOrder: {},
  answers,
  checked: {},
  flagged,
  index: 0,
  elapsedMs: 123000,
})

describe('isCorrect', () => {
  it('requires the exact set for multi-select', () => {
    expect(isCorrect(Q[1], ['A', 'C'])).toBe(true)
    expect(isCorrect(Q[1], ['C', 'A'])).toBe(true)
    expect(isCorrect(Q[1], ['A'])).toBe(false)
    expect(isCorrect(Q[1], ['A', 'B', 'C'])).toBe(false)
    expect(isCorrect(Q[1], ['A', 'B'])).toBe(false)
    expect(isCorrect(Q[1], [])).toBe(false)
  })
  it('works for single choice', () => {
    expect(isCorrect(Q[0], ['B'])).toBe(true)
    expect(isCorrect(Q[0], ['A'])).toBe(false)
  })
})

describe('gradeQuestion', () => {
  it('flags unanswered questions as not answered and not correct', () => {
    expect(gradeQuestion(Q[0], undefined, true)).toEqual({ id: 'q1', selected: [], answered: false, correct: false, flagged: true })
    expect(gradeQuestion(Q[0], [], false).answered).toBe(false)
  })
})

describe('estimateScaledScore', () => {
  it('maps 70% to 700 and clamps to 100-1000', () => {
    expect(estimateScaledScore(70)).toBe(700)
    expect(estimateScaledScore(100)).toBe(1000)
    expect(estimateScaledScore(0)).toBe(100)
    expect(estimateScaledScore(5)).toBe(100)
    expect(estimateScaledScore(94)).toBe(940)
  })
})

describe('scoreSession', () => {
  it('scores mixed answers, per-domain totals and the pass mark', () => {
    const a = scoreSession(session({ q1: ['B'], q2: ['A', 'C'], q3: ['A'] }, { q3: true }), byId, 999)
    expect(a.total).toBe(4)
    expect(a.correct).toBe(2)
    expect(a.answered).toBe(3)
    expect(a.unanswered).toBe(1)
    expect(a.percent).toBe(50)
    expect(a.passed).toBe(false)
    expect(a.scaled).toBe(500)
    expect(a.domains).toEqual({ Model: { total: 2, correct: 2 }, Prepare: { total: 1, correct: 0 }, Manage: { total: 1, correct: 0 } })
    expect(a.results.find((r) => r.id === 'q3')?.flagged).toBe(true)
    expect(a.durationMs).toBe(123000)
    expect(a.timeLimitMs).toBe(400000)
  })

  it('passes at exactly 70% and fails just below', () => {
    const ten = Array.from({ length: 10 }, (_, i) => mk(`q${i + 1}`, 'Model', 'DAX', ['A']))
    const results = (nCorrect: number) =>
      ten.map((q, i) => ({ id: q.id, selected: ['A'], answered: true, correct: i < nCorrect, flagged: false }))
    expect(summarize(ten, results(7)).passed).toBe(true)
    expect(summarize(ten, results(6)).passed).toBe(false)
  })

  it('has no time limit when the timer is off and handles an empty quiz', () => {
    const s = { ...session({}), config: { ...config, timerEnabled: false } }
    expect(scoreSession(s, byId, 1).timeLimitMs).toBeNull()
    expect(summarize([], []).percent).toBe(0)
  })
})

describe('weakTopics', () => {
  it('lists only missed topics, worst first', () => {
    const results = [
      { id: 'q1', selected: ['B'], answered: true, correct: true, flagged: false },
      { id: 'q2', selected: ['A'], answered: true, correct: false, flagged: false },
      { id: 'q3', selected: [], answered: false, correct: false, flagged: false },
      { id: 'q4', selected: ['A'], answered: true, correct: true, flagged: false },
    ]
    const weak = weakTopics(byId, results)
    expect(weak.map((t) => t.topic)).toEqual(['Power Query', 'DAX'])
    expect(weak[1]).toMatchObject({ total: 2, correct: 1, percent: 50 })
  })
})

describe('stats', () => {
  it('records answered questions only and accumulates over attempts', () => {
    const r1 = [
      { id: 'q1', selected: ['A'], answered: true, correct: false, flagged: false },
      { id: 'q2', selected: [], answered: false, correct: false, flagged: false },
    ]
    const s1 = applyAttemptToStats({}, r1, 10)
    expect(s1).toEqual({ q1: { attempts: 1, correct: 0, lastCorrect: false, lastAt: 10 } })
    const s2 = applyAttemptToStats(s1, [{ id: 'q1', selected: ['B'], answered: true, correct: true, flagged: false }], 20)
    expect(s2.q1).toEqual({ attempts: 2, correct: 1, lastCorrect: true, lastAt: 20 })
    expect(s1.q1.attempts).toBe(1) // input not mutated
    const acc = domainAccuracy(Q, s2)
    expect(acc.Model).toEqual({ attempts: 2, correct: 1, percent: 50 })
    expect(acc.Prepare.attempts).toBe(0)
  })
})
