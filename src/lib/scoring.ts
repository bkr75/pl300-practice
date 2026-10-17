import type { Attempt, DomainScore, Question, QuestionResult, QuestionStat, Session, Stats } from '../types'

export const PASS_PERCENT = 70
export const PASS_SCALED = 700

/** A question is correct only when the selected set equals the correct set. */
export function isCorrect(question: Pick<Question, 'correct'>, selected: readonly string[]): boolean {
  if (selected.length !== question.correct.length) return false
  const chosen = new Set(selected)
  return question.correct.every((key) => chosen.has(key))
}

/**
 * Rough scaled score estimate. The real PL-300 uses a 100-1000 scale where 700
 * passes and the mapping is not published, so we map the percentage linearly
 * (70% -> 700) and floor at 100. Treat it as an estimate only.
 */
export function estimateScaledScore(percent: number): number {
  return Math.min(1000, Math.max(100, Math.round(percent * 10)))
}

export function percentOf(correct: number, total: number): number {
  return total === 0 ? 0 : (correct / total) * 100
}

export function gradeQuestion(question: Question, selected: readonly string[] | undefined, flagged: boolean): QuestionResult {
  const chosen = selected ?? []
  const answered = chosen.length > 0
  return {
    id: question.id,
    selected: [...chosen],
    answered,
    correct: answered && isCorrect(question, chosen),
    flagged,
  }
}

export function summarize(
  questions: readonly Question[],
  results: readonly QuestionResult[],
): Pick<Attempt, 'total' | 'answered' | 'correct' | 'unanswered' | 'percent' | 'scaled' | 'passed' | 'domains'> {
  const byId = new Map(questions.map((q) => [q.id, q]))
  const domains: Record<string, DomainScore> = {}
  let correct = 0
  let answered = 0
  for (const r of results) {
    const q = byId.get(r.id)
    if (!q) continue
    const d = (domains[q.domain] ??= { total: 0, correct: 0 })
    d.total += 1
    if (r.correct) {
      d.correct += 1
      correct += 1
    }
    if (r.answered) answered += 1
  }
  const total = results.length
  const percent = percentOf(correct, total)
  return {
    total,
    answered,
    correct,
    unanswered: total - answered,
    percent,
    scaled: estimateScaledScore(percent),
    passed: percent >= PASS_PERCENT,
    domains,
  }
}

export function scoreSession(
  session: Session,
  questionsById: ReadonlyMap<string, Question>,
  finishedAt: number,
): Attempt {
  const questions = session.questionIds.map((id) => questionsById.get(id)).filter((q): q is Question => !!q)
  const results = questions.map((q) => gradeQuestion(q, session.answers[q.id], !!session.flagged[q.id]))
  const { config } = session
  return {
    id: session.id,
    finishedAt,
    mode: config.mode,
    label: session.label,
    ...summarize(questions, results),
    durationMs: session.elapsedMs,
    timeLimitMs: config.timerEnabled ? config.secondsPerQuestion * 1000 * questions.length : null,
    results,
    optionOrder: session.optionOrder,
  }
}

export interface TopicScore {
  topic: string
  domain: string
  total: number
  correct: number
  percent: number
}

/** Topics where at least one question was missed, worst first. */
export function weakTopics(
  questionsById: ReadonlyMap<string, Question>,
  results: readonly QuestionResult[],
): TopicScore[] {
  const topics = new Map<string, TopicScore>()
  for (const r of results) {
    const q = questionsById.get(r.id)
    if (!q) continue
    const t = topics.get(q.topic) ?? { topic: q.topic, domain: q.domain, total: 0, correct: 0, percent: 0 }
    t.total += 1
    if (r.correct) t.correct += 1
    topics.set(q.topic, t)
  }
  return [...topics.values()]
    .map((t) => ({ ...t, percent: percentOf(t.correct, t.total) }))
    .filter((t) => t.correct < t.total)
    .sort((a, b) => a.percent - b.percent || b.total - a.total || a.topic.localeCompare(b.topic))
}

/** Fold an attempt's answered questions into the per-question statistics. */
export function applyAttemptToStats(stats: Stats, results: readonly QuestionResult[], at: number): Stats {
  const next: Stats = { ...stats }
  for (const r of results) {
    if (!r.answered) continue
    const prev: QuestionStat = next[r.id] ?? { attempts: 0, correct: 0, lastCorrect: false, lastAt: 0 }
    next[r.id] = {
      attempts: prev.attempts + 1,
      correct: prev.correct + (r.correct ? 1 : 0),
      lastCorrect: r.correct,
      lastAt: at,
    }
  }
  return next
}

/** Accuracy per domain across every recorded answer, for the dashboard. */
export function domainAccuracy(
  questions: readonly Question[],
  stats: Stats,
): Record<string, { attempts: number; correct: number; percent: number }> {
  const out: Record<string, { attempts: number; correct: number; percent: number }> = {}
  for (const q of questions) {
    const d = (out[q.domain] ??= { attempts: 0, correct: 0, percent: 0 })
    const s = stats[q.id]
    if (s) {
      d.attempts += s.attempts
      d.correct += s.correct
    }
  }
  for (const d of Object.values(out)) d.percent = percentOf(d.correct, d.attempts)
  return out
}
