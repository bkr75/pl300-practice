import type { CaseStudy, Question } from '../types'
import { t, tn } from '../i18n'
import { CodeBlock, Icon } from './ui'

/* ---------- stem + code + selection hint ---------- */

const CODE_MARK = '{{code}}'

/** The stem may contain a `{{code}}` paragraph marking where the code snippet belongs. */
export function QuestionStem({ question, id }: { question: Question; id: string }) {
  const paragraphs = question.stem.split('\n\n')
  const inline = question.code !== null && paragraphs.includes(CODE_MARK)
  return (
    <div>
      <div id={id} className="space-y-3 text-[17px] leading-relaxed font-medium">
        {paragraphs.map((p, i) =>
          p === CODE_MARK && question.code ? (
            <div key={i} className="font-normal">
              <CodeBlock code={question.code} />
            </div>
          ) : (
            <p key={i} className="whitespace-pre-line">
              {p}
            </p>
          ),
        )}
      </div>
      {question.code && !inline && (
        <div className="mt-4">
          <CodeBlock code={question.code} />
        </div>
      )}
      <p className="mt-4 text-sm font-semibold text-muted">
        {question.type === 'multi' ? tn('question.selectN', question.correct.length) : t('question.selectOne')}
      </p>
    </div>
  )
}

/* ---------- options ---------- */

export function OptionList({
  question,
  order,
  selected,
  reveal = false,
  disabled = false,
  onToggle,
  labelledBy,
}: {
  question: Question
  order: string[]
  selected: string[]
  /** Colour options as correct/wrong and show per-option explanations. */
  reveal?: boolean
  disabled?: boolean
  onToggle?: (key: string) => void
  labelledBy?: string
}) {
  const multi = question.type === 'multi'
  const byKey = new Map(question.options.map((o) => [o.key, o]))

  return (
    <div role={multi ? 'group' : 'radiogroup'} aria-labelledby={labelledBy} className="space-y-3">
      {order.map((key, position) => {
        const option = byKey.get(key)
        if (!option) return null
        const isSelected = selected.includes(key)
        const isCorrectKey = question.correct.includes(key)
        const letter = String.fromCharCode(65 + position)

        let tone = 'border-line bg-surface hover:border-muted/60 hover:bg-surface2'
        let badge = 'bg-surface2 text-muted'
        let tag: string | null = null
        if (isSelected && !reveal) {
          tone = 'border-accent bg-accent/15'
          badge = 'bg-accent text-accent-ink'
        }
        if (reveal) {
          if (isCorrectKey) {
            tone = 'border-ok-line bg-ok-bg'
            badge = 'bg-ok text-white'
            tag = isSelected ? t('option.yourCorrect') : t('option.correctMissed')
          } else if (isSelected) {
            tone = 'border-bad-line bg-bad-bg'
            badge = 'bg-bad text-white'
            tag = t('option.yourWrong')
          } else {
            tone = 'border-line bg-surface opacity-80'
          }
        }

        return (
          <div key={key}>
            <button
              type="button"
              role={multi ? 'checkbox' : 'radio'}
              aria-checked={isSelected}
              aria-keyshortcuts={letter}
              data-option
              disabled={disabled}
              onClick={() => onToggle?.(key)}
              className={`flex w-full cursor-pointer items-start gap-3 rounded-xl border-2 p-3.5 text-left transition duration-150 enabled:active:scale-[0.995] disabled:cursor-default ${tone}`}
            >
              <span
                className={`mt-0.5 grid size-7 shrink-0 place-items-center text-xs font-bold ${multi ? 'rounded-md' : 'rounded-full'} ${badge}`}
              >
                {reveal && isCorrectKey ? <Icon name="check" className="size-4" /> : reveal && isSelected ? <Icon name="x" className="size-4" /> : letter}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] leading-snug">{option.text}</span>
                {tag && (
                  <span
                    className={`mt-1.5 inline-block text-xs font-bold tracking-wide uppercase ${
                      isCorrectKey ? 'text-ok' : 'text-bad'
                    }`}
                  >
                    {letter} · {tag}
                  </span>
                )}
              </span>
            </button>
            {reveal && option.explanation && (
              <p className="mt-1.5 ml-10 text-sm leading-relaxed text-muted">{option.explanation}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ---------- explanation ---------- */

function Reference({ value }: { value: string }) {
  const url = value.match(/https?:\/\/\S+/)?.[0]
  return (
    <p className="mt-3 flex items-start gap-2 text-sm text-muted">
      <Icon name="book" className="mt-0.5 size-4 shrink-0" />
      <span>
        <span className="font-semibold">{t('explanation.reference')}: </span>
        {url ? (
          <a href={url} target="_blank" rel="noreferrer" className="break-all text-info underline underline-offset-2">
            {url}
          </a>
        ) : (
          value
        )}
      </span>
    </p>
  )
}

/**
 * Question-level explanation (when the bank has one) plus the concept/reference line.
 * Banks with an explanation for every option show those under each option instead.
 */
export function ExplanationPanel({ question }: { question: Question }) {
  const perOption = question.options.some((o) => o.explanation)
  if (!question.explanation && !question.reference) return null
  return (
    <div className="rounded-xl border border-line bg-surface2 p-4">
      {question.explanation && (
        <>
          <h3 className="text-xs font-bold tracking-wide text-muted uppercase">{t('explanation.title')}</h3>
          <p className="mt-2 text-[15px] leading-relaxed">{question.explanation}</p>
        </>
      )}
      {!question.explanation && perOption && (
        <p className="mb-1 text-xs font-bold tracking-wide text-muted uppercase">{t('explanation.perOption')}</p>
      )}
      {question.reference && <Reference value={question.reference} />}
    </div>
  )
}

/* ---------- case study ---------- */

export function CasePanel({ study }: { study: CaseStudy }) {
  return (
    <details open className="card mb-4 overflow-hidden">
      <summary className="flex cursor-pointer items-center justify-between gap-2 bg-info-bg px-4 py-3 text-sm font-bold text-info">
        <span className="flex items-center gap-2">
          <Icon name="book" className="size-4" />
          {t('case.title', { title: study.title })}
        </span>
        <Icon name="down" className="size-4" />
      </summary>
      <div className="max-h-96 space-y-1.5 overflow-y-auto p-4 text-sm leading-relaxed">
        {study.text.split('\n').map((line, i) =>
          line.startsWith('•') ? (
            <p key={i} className="flex gap-2 pl-1">
              <span aria-hidden="true">•</span>
              <span>{line.replace(/^•\s*/, '')}</span>
            </p>
          ) : line.length < 40 && !line.endsWith('.') ? (
            <h4 key={i} className="pt-2 font-bold">
              {line}
            </h4>
          ) : (
            <p key={i}>{line}</p>
          ),
        )}
      </div>
    </details>
  )
}

/* ---------- overview grid ---------- */

export type NavState = 'unanswered' | 'answered' | 'correct' | 'wrong'

export function QuestionNav({
  ids,
  current,
  stateOf,
  isFlagged,
  onGo,
}: {
  ids: string[]
  current: number
  stateOf: (id: string) => NavState
  isFlagged: (id: string) => boolean
  onGo: (index: number) => void
}) {
  const tone: Record<NavState, string> = {
    unanswered: 'border-line bg-surface text-muted hover:bg-surface2',
    answered: 'border-info bg-info-bg text-info',
    correct: 'border-ok-line bg-ok-bg text-ok',
    wrong: 'border-bad-line bg-bad-bg text-bad',
  }
  const stateLabel: Record<NavState, string> = {
    unanswered: t('nav.unanswered'),
    answered: t('nav.answered'),
    correct: t('nav.correct'),
    wrong: t('nav.wrong'),
  }
  return (
    <ol className="grid grid-cols-6 gap-1.5 sm:grid-cols-8 lg:grid-cols-5">
      {ids.map((id, i) => {
        const state = stateOf(id)
        const flagged = isFlagged(id)
        return (
          <li key={id}>
            <button
              type="button"
              onClick={() => onGo(i)}
              aria-current={i === current ? 'step' : undefined}
              aria-label={t('nav.itemLabel', { n: i + 1, state: stateLabel[state] }) + (flagged ? `, ${t('nav.flagged')}` : '')}
              className={`relative grid h-9 w-full cursor-pointer place-items-center rounded-lg border text-xs font-bold transition ${tone[state]} ${
                i === current ? 'ring-2 ring-accent ring-offset-2 ring-offset-surface' : ''
              }`}
            >
              {i + 1}
              {flagged && (
                <span className="absolute -top-1 -right-1 grid size-4 place-items-center rounded-full bg-accent text-accent-ink">
                  <Icon name="flag" className="size-2.5" />
                </span>
              )}
            </button>
          </li>
        )
      })}
    </ol>
  )
}
