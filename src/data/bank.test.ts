import { describe, expect, it } from 'vitest'
import { bank, bankStats } from './bank'

const DOMAIN_TARGETS: Record<string, number> = {
  'Prepare the data': 80,
  'Model the data': 80,
  'Visualize and analyze the data': 80,
  'Manage and secure Power BI': 60,
}

describe('question bank integrity', () => {
  it('has 300 questions in the four official domains with the expected counts', () => {
    expect(bank.questions).toHaveLength(300)
    expect(bank.domains).toEqual(Object.keys(DOMAIN_TARGETS))
    const counts = Object.fromEntries(bank.domains.map((d) => [d, bank.questions.filter((q) => q.domain === d).length]))
    expect(counts).toEqual(DOMAIN_TARGETS)
  })

  it('has 12 multi-select questions and 288 single-answer questions', () => {
    expect(bankStats.multi).toBe(12)
    expect(bank.questions.filter((q) => q.type === 'single')).toHaveLength(288)
  })

  it('has unique ids and sequential numbers', () => {
    expect(new Set(bank.questions.map((q) => q.id)).size).toBe(300)
    bank.questions.forEach((q, i) => expect(q.number).toBe(i + 1))
  })

  it('has valid options, correct answers and an explanation for every option', () => {
    for (const q of bank.questions) {
      const keys = q.options.map((o) => o.key)
      expect(keys.length, q.id).toBeGreaterThanOrEqual(3)
      expect(new Set(keys).size, q.id).toBe(keys.length)
      expect(q.correct.length, q.id).toBeGreaterThanOrEqual(1)
      for (const k of q.correct) expect(keys, `${q.id} correct key`).toContain(k)
      expect(q.type === 'multi', `${q.id} type`).toBe(q.correct.length > 1)
      expect(q.stem.length, q.id).toBeGreaterThan(10)
      expect(bank.domains, q.id).toContain(q.domain)
      for (const o of q.options) {
        expect(o.text.trim().length, `${q.id}${o.key} text`).toBeGreaterThan(0)
        expect(o.explanation?.trim().length ?? 0, `${q.id}${o.key} explanation`).toBeGreaterThan(5)
      }
    }
  })

  it('has five case studies of five questions each, all referenced correctly', () => {
    expect(bank.cases).toHaveLength(5)
    for (const c of bank.cases) {
      expect(c.title.length).toBeGreaterThan(3)
      expect(c.text.length).toBeGreaterThan(200)
      expect(bank.questions.filter((q) => q.caseId === c.id)).toHaveLength(5)
    }
    const caseIds = new Set(bank.cases.map((c) => c.id))
    for (const q of bank.questions) if (q.caseId) expect(caseIds.has(q.caseId)).toBe(true)
  })

  it('keeps case questions of one case consecutive within their set', () => {
    for (const c of bank.cases) {
      const nums = bank.questions.filter((q) => q.caseId === c.id).map((q) => q.number)
      expect(nums[nums.length - 1] - nums[0]).toBe(4)
    }
  })

  it('stores code snippets separately and marks their position in the stem', () => {
    const withCode = bank.questions.filter((q) => q.code)
    expect(withCode.map((q) => q.id)).toEqual(['s1q12', 's3q32', 's4q01', 's5q29'])
    for (const q of withCode) expect(q.stem).toContain('{{code}}')
    for (const q of bank.questions.filter((x) => !x.code)) expect(q.stem).not.toContain('{{code}}')
  })

  it('has no leftover page footers in the text', () => {
    for (const q of bank.questions) {
      const all = [q.stem, ...q.options.flatMap((o) => [o.text, o.explanation ?? ''])].join(' ')
      expect(all, q.id).not.toMatch(/Practice Question Bank/)
    }
  })
})
