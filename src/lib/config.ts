import { bank, bankStats } from '../data/bank'
import type { Mode, QuizConfig } from '../types'
import { DEFAULT_SECONDS_PER_QUESTION } from './select'

export function defaultConfig(mode: Mode = 'practice', overrides: Partial<QuizConfig> = {}): QuizConfig {
  return {
    mode,
    source: 'standard',
    domains: [...bank.domains],
    count: Math.min(25, bankStats.questions),
    shuffleQuestions: true,
    shuffleOptions: true,
    // Exam mode defaults to the real exam pace of 1 min 40 s per question.
    timerEnabled: mode === 'exam',
    secondsPerQuestion: DEFAULT_SECONDS_PER_QUESTION,
    includeCases: true,
    ...overrides,
  }
}
