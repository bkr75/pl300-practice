import raw from './questions.json'
import type { Bank, CaseStudy, Question } from '../types'

/**
 * The question bank. To use a different bank (for example 300 questions with
 * case studies), replace questions.json: the app derives domains, counts and
 * case studies from the data, nothing is hard-coded.
 */
export const bank: Bank = {
  domains: raw.domains as string[],
  cases: raw.cases as CaseStudy[],
  questions: raw.questions as Question[],
}

export const questionsById: ReadonlyMap<string, Question> = new Map(bank.questions.map((q) => [q.id, q]))
export const casesById: ReadonlyMap<string, CaseStudy> = new Map(bank.cases.map((c) => [c.id, c]))

export function domainCounts(): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const d of bank.domains) counts[d] = 0
  for (const q of bank.questions) counts[q.domain] = (counts[q.domain] ?? 0) + 1
  return counts
}

export const bankStats = {
  questions: bank.questions.length,
  domains: bank.domains.length,
  cases: bank.cases.length,
  multi: bank.questions.filter((q) => q.type === 'multi').length,
}
