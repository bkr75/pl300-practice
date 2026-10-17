import type { Attempt, Question } from '../types'

/** Self-contained JSON export of an attempt, including the question text. */
export function buildExport(attempt: Attempt, questionsById: ReadonlyMap<string, Question>) {
  return {
    app: 'PL-300 Practice',
    exportedAt: new Date().toISOString(),
    attempt: {
      id: attempt.id,
      finishedAt: new Date(attempt.finishedAt).toISOString(),
      mode: attempt.mode,
      label: attempt.label,
      total: attempt.total,
      answered: attempt.answered,
      correct: attempt.correct,
      percent: Math.round(attempt.percent * 10) / 10,
      estimatedScaledScore: attempt.scaled,
      passed: attempt.passed,
      durationSeconds: Math.round(attempt.durationMs / 1000),
      domains: attempt.domains,
    },
    questions: attempt.results.map((r) => {
      const q = questionsById.get(r.id)
      return {
        id: r.id,
        domain: q?.domain,
        topic: q?.topic,
        stem: q?.stem,
        code: q?.code,
        yourAnswer: r.selected,
        correctAnswer: q?.correct,
        result: !r.answered ? 'unanswered' : r.correct ? 'correct' : 'wrong',
        flagged: r.flagged,
        explanation: q?.explanation,
      }
    }),
  }
}

export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
