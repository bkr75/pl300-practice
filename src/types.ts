export type QuestionType = 'single' | 'multi'
export type Mode = 'practice' | 'exam'
/** Where the pool of candidate questions comes from. */
export type Source = 'standard' | 'weak' | 'wrong'

export interface Option {
  key: string
  text: string
  /** Per-option explanation. Null when the bank only has a question-level one. */
  explanation: string | null
}

export interface Question {
  id: string
  number: number
  domain: string
  topic: string
  type: QuestionType
  caseId: string | null
  stem: string
  code: string | null
  options: Option[]
  correct: string[]
  explanation: string
  reference: string | null
}

export interface CaseStudy {
  id: string
  title: string
  text: string
}

export interface Bank {
  domains: string[]
  cases: CaseStudy[]
  questions: Question[]
}

export interface QuizConfig {
  mode: Mode
  source: Source
  domains: string[]
  count: number
  shuffleQuestions: boolean
  shuffleOptions: boolean
  timerEnabled: boolean
  secondsPerQuestion: number
  includeCases: boolean
}

export interface Session {
  id: string
  startedAt: number
  config: QuizConfig
  /** Short label such as "Retry: wrong answers". */
  label: string | null
  questionIds: string[]
  /** Display order of option keys per question (shuffled when requested). */
  optionOrder: Record<string, string[]>
  answers: Record<string, string[]>
  checked: Record<string, boolean>
  flagged: Record<string, boolean>
  index: number
  elapsedMs: number
}

export interface QuestionResult {
  id: string
  selected: string[]
  answered: boolean
  correct: boolean
  flagged: boolean
}

export interface DomainScore {
  total: number
  correct: number
}

export interface Attempt {
  id: string
  finishedAt: number
  mode: Mode
  label: string | null
  total: number
  answered: number
  correct: number
  unanswered: number
  percent: number
  /** Estimated scaled score (100-1000), see scoring.ts. */
  scaled: number
  passed: boolean
  durationMs: number
  timeLimitMs: number | null
  domains: Record<string, DomainScore>
  results: QuestionResult[]
  optionOrder: Record<string, string[]>
}

export interface QuestionStat {
  attempts: number
  correct: number
  lastCorrect: boolean
  lastAt: number
}

export type Stats = Record<string, QuestionStat>
