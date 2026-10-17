import type { Attempt, Bank, Question, QuizConfig, Session, Stats } from '../types'
import { distribute } from './distribution'
import { shuffle, type Rng } from './rng'

export const DEFAULT_SECONDS_PER_QUESTION = 100 // 1 min 40 s, in line with the real exam pace

export interface PoolContext {
  stats: Stats
  /** Most recent finished attempt, used by the "wrong in last attempt" source. */
  lastAttempt: Attempt | null
}

/** Questions the config is allowed to draw from. */
export function candidatePool(bank: Bank, config: QuizConfig, ctx: PoolContext): Question[] {
  const domains = new Set(config.domains)
  let pool = bank.questions.filter((q) => domains.has(q.domain))
  if (!config.includeCases) pool = pool.filter((q) => q.caseId === null)
  if (config.source === 'wrong') {
    const wrong = new Set(ctx.lastAttempt?.results.filter((r) => !r.correct).map((r) => r.id) ?? [])
    pool = pool.filter((q) => wrong.has(q.id))
  }
  return pool
}

export function poolByDomain(pool: readonly Question[], domains: readonly string[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const d of domains) counts[d] = 0
  for (const q of pool) counts[q.domain] = (counts[q.domain] ?? 0) + 1
  return counts
}

/** Weight for the "weak areas" source: favours questions missed or never seen. */
export function weaknessWeight(stat: Stats[string] | undefined): number {
  if (!stat || stat.attempts === 0) return 2 // unseen questions deserve some exposure
  const missRate = 1 - stat.correct / stat.attempts
  return 1 + 12 * missRate + (stat.lastCorrect ? 0 : 6)
}

/** Weighted sampling without replacement (Efraimidis-Spirakis). */
export function weightedSample<T>(items: readonly T[], weight: (item: T) => number, count: number, rng: Rng): T[] {
  return items
    .map((item) => ({ item, key: Math.pow(Math.max(rng(), Number.EPSILON), 1 / Math.max(weight(item), 1e-6)) }))
    .sort((a, b) => b.key - a.key)
    .slice(0, count)
    .map((entry) => entry.item)
}

/** Keep questions of one case study next to each other, ordered by first appearance. */
export function clusterCases(questions: readonly Question[]): Question[] {
  const groups = new Map<string, Question[]>()
  const order: string[] = []
  for (const q of questions) {
    const key = q.caseId ? `case:${q.caseId}` : `q:${q.id}`
    if (!groups.has(key)) {
      groups.set(key, [])
      order.push(key)
    }
    groups.get(key)!.push(q)
  }
  return order.flatMap((key) => groups.get(key)!)
}

/**
 * Choose the questions for a quiz. For the standard and "wrong" sources the
 * requested count is split across domains with the largest-remainder method
 * and questions are picked at random inside each domain. For "weak" the picks
 * are weighted by past performance instead.
 */
export function pickQuestions(
  bank: Bank,
  config: QuizConfig,
  ctx: PoolContext,
  rng: Rng = Math.random,
): Question[] {
  const pool = candidatePool(bank, config, ctx)
  const count = Math.max(0, Math.min(config.count, pool.length))
  let picked: Question[]

  if (config.source === 'weak') {
    picked = weightedSample(pool, (q) => weaknessWeight(ctx.stats[q.id]), count, rng)
  } else {
    const counts = distribute(count, poolByDomain(pool, config.domains))
    picked = []
    for (const domain of config.domains) {
      const inDomain = shuffle(
        pool.filter((q) => q.domain === domain),
        rng,
      )
      picked.push(...inDomain.slice(0, counts[domain] ?? 0))
    }
  }

  const ordered = config.shuffleQuestions
    ? shuffle(picked, rng)
    : picked.sort((a, b) => a.number - b.number)
  return clusterCases(ordered)
}

export function makeOptionOrder(question: Question, shuffleOptions: boolean, rng: Rng = Math.random): string[] {
  const keys = question.options.map((o) => o.key)
  return shuffleOptions ? shuffle(keys, rng) : keys
}

export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`
}

export function createSession(
  questions: readonly Question[],
  config: QuizConfig,
  options: { label?: string | null; rng?: Rng; now?: number } = {},
): Session {
  const rng = options.rng ?? Math.random
  const optionOrder: Record<string, string[]> = {}
  for (const q of questions) optionOrder[q.id] = makeOptionOrder(q, config.shuffleOptions, rng)
  return {
    id: newId('s'),
    startedAt: options.now ?? Date.now(),
    config,
    label: options.label ?? null,
    questionIds: questions.map((q) => q.id),
    optionOrder,
    answers: {},
    checked: {},
    flagged: {},
    index: 0,
    elapsedMs: 0,
  }
}
