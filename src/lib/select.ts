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

/** 0 = missed at least once, 1 = never answered, 2 = always answered correctly. */
export function weakTier(stat: Stats[string] | undefined): 0 | 1 | 2 {
  if (!stat || stat.attempts === 0) return 1
  return stat.correct < stat.attempts ? 0 : 2
}

/**
 * Order for the "weak areas" source:
 *  1. questions you have missed, worst miss rate first (ties: last answer wrong first, then random),
 *  2. questions you have not answered yet (random),
 *  3. questions you always answered correctly (random).
 * A quiz of N takes the first N, so previously missed questions always come first.
 */
export function weakPriority(pool: readonly Question[], stats: Stats, rng: Rng = Math.random): Question[] {
  const missRate = (q: Question) => 1 - stats[q.id].correct / stats[q.id].attempts
  // shuffle first: Array.sort is stable, so equal questions keep this random order
  return shuffle(pool, rng).sort((a, b) => {
    const ta = weakTier(stats[a.id])
    const tb = weakTier(stats[b.id])
    if (ta !== tb) return ta - tb
    if (ta !== 0) return 0
    return missRate(b) - missRate(a) || Number(stats[a.id].lastCorrect) - Number(stats[b.id].lastCorrect)
  })
}

/** How many questions in the pool the user has missed at least once. */
export function countMissed(pool: readonly Question[], stats: Stats): number {
  return pool.filter((q) => weakTier(stats[q.id]) === 0).length
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
 * and questions are picked at random inside each domain. For "weak" the
 * questions you missed come first (see weakPriority).
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
    picked = weakPriority(pool, ctx.stats, rng).slice(0, count)
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
