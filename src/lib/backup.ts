import type { Attempt, QuestionStat, Stats } from '../types'

export const BACKUP_APP = 'pl300-practice'
export const MAX_HISTORY = 100

export interface Backup {
  app: typeof BACKUP_APP
  version: 1
  exportedAt: string
  history: Attempt[]
  stats: Stats
}

export function buildBackup(history: Attempt[], stats: Stats, now: Date = new Date()): Backup {
  return { app: BACKUP_APP, version: 1, exportedAt: now.toISOString(), history, stats }
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

function validAttempt(a: unknown): a is Attempt {
  return (
    isObject(a) &&
    typeof a.id === 'string' &&
    typeof a.finishedAt === 'number' &&
    typeof a.percent === 'number' &&
    typeof a.total === 'number' &&
    typeof a.correct === 'number' &&
    (a.mode === 'practice' || a.mode === 'exam') &&
    Array.isArray(a.results) &&
    isObject(a.domains) &&
    isObject(a.optionOrder)
  )
}

function validStat(s: unknown): s is QuestionStat {
  return (
    isObject(s) &&
    typeof s.attempts === 'number' &&
    typeof s.correct === 'number' &&
    typeof s.lastCorrect === 'boolean' &&
    typeof s.lastAt === 'number'
  )
}

/** Parse and validate a backup file. Returns null when it is not a usable backup. */
export function parseBackup(text: string): Backup | null {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return null
  }
  if (!isObject(data) || data.app !== BACKUP_APP || !Array.isArray(data.history) || !isObject(data.stats)) return null
  const history = data.history.filter(validAttempt)
  const stats: Stats = {}
  for (const [id, s] of Object.entries(data.stats)) if (validStat(s)) stats[id] = s
  return { app: BACKUP_APP, version: 1, exportedAt: typeof data.exportedAt === 'string' ? data.exportedAt : '', history, stats }
}

/**
 * Merge a backup into the current data (nothing is lost on either side):
 * attempts are united by id (newest first, capped), and for each question the
 * statistic with the most recent answer wins, since attempt counts cannot be
 * added without double counting answers that exist in both places.
 */
export function mergeBackup(
  current: { history: Attempt[]; stats: Stats },
  incoming: { history: Attempt[]; stats: Stats },
): { history: Attempt[]; stats: Stats; addedAttempts: number } {
  const known = new Set(current.history.map((a) => a.id))
  const fresh = incoming.history.filter((a) => !known.has(a.id))
  const history = [...current.history, ...fresh].sort((a, b) => b.finishedAt - a.finishedAt).slice(0, MAX_HISTORY)

  const stats: Stats = { ...current.stats }
  for (const [id, s] of Object.entries(incoming.stats)) {
    const mine = stats[id]
    if (!mine || s.lastAt > mine.lastAt) stats[id] = s
  }
  return { history, stats, addedAttempts: fresh.length }
}
