import { useEffect, useMemo, useState } from 'react'
import { DomainBars, ScoreRing } from '../components/charts'
import { CasePanel, ExplanationPanel, OptionList, QuestionStem } from '../components/question'
import { DomainBadge, Icon } from '../components/ui'
import { bank, casesById, questionsById } from '../data/bank'
import { t, tn } from '../i18n'
import { defaultConfig } from '../lib/config'
import { buildExport, downloadJson } from '../lib/export'
import { formatDateTime, formatDuration, formatPercent } from '../lib/format'
import { useRoute } from '../lib/router'
import { PASS_PERCENT, PASS_SCALED, weakTopics } from '../lib/scoring'
import { useApp } from '../state/AppState'
import type { Attempt, QuestionResult } from '../types'

type Filter = 'all' | 'wrong' | 'correct' | 'flagged' | 'unanswered'

const matches = (r: QuestionResult, f: Filter) =>
  f === 'all' ||
  (f === 'wrong' && r.answered && !r.correct) ||
  (f === 'correct' && r.correct) ||
  (f === 'flagged' && r.flagged) ||
  (f === 'unanswered' && !r.answered)

export function Results() {
  const { history, startQuiz } = useApp()
  const route = useRoute()
  const id = route.path.split('/')[2]
  const attempt = history.find((a) => a.id === id)
  if (!attempt) {
    return (
      <div className="card mx-auto max-w-lg p-8 text-center">
        <p className="font-bold">{t('results.notFound')}</p>
        <a href="#/history" className="btn-primary mt-4">
          {t('results.toProgress')}
        </a>
      </div>
    )
  }
  return <ResultsView attempt={attempt} startQuiz={startQuiz} />
}

function ResultsView({ attempt, startQuiz }: { attempt: Attempt; startQuiz: ReturnType<typeof useApp>['startQuiz'] }) {
  const [filter, setFilter] = useState<Filter>('all')
  const [expandAll, setExpandAll] = useState(false)

  // Open every review item while printing so the printout contains the explanations.
  useEffect(() => {
    const before = () => setExpandAll(true)
    window.addEventListener('beforeprint', before)
    return () => window.removeEventListener('beforeprint', before)
  }, [])

  const missed = attempt.results.filter((r) => !r.correct)
  const weak = useMemo(() => weakTopics(questionsById, attempt.results), [attempt])
  const counts: Record<Filter, number> = {
    all: attempt.results.length,
    wrong: attempt.results.filter((r) => matches(r, 'wrong')).length,
    correct: attempt.results.filter((r) => matches(r, 'correct')).length,
    flagged: attempt.results.filter((r) => matches(r, 'flagged')).length,
    unanswered: attempt.results.filter((r) => matches(r, 'unanswered')).length,
  }
  const rows = bank.domains
    .filter((d) => attempt.domains[d])
    .map((d) => ({ domain: d, correct: attempt.domains[d].correct, total: attempt.domains[d].total }))
  const visible = attempt.results.map((r, i) => ({ r, i })).filter(({ r }) => matches(r, filter))

  const retry = () =>
    startQuiz(defaultConfig(attempt.mode, { count: missed.length }), {
      questions: missed.flatMap((r) => questionsById.get(r.id) ?? []),
      label: t('label.retryMissed'),
    })

  const print = () => {
    setExpandAll(true)
    window.setTimeout(() => window.print(), 80)
  }

  return (
    <div className="rise space-y-6">
      {/* summary */}
      <section className="card p-5 sm:p-8" aria-labelledby="result-title">
        <div className="flex flex-wrap items-center gap-6 sm:gap-10">
          <ScoreRing percent={attempt.percent} passed={attempt.passed} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-muted">
              {t(attempt.mode === 'exam' ? 'mode.exam' : 'mode.practice')}
              {attempt.label ? ` · ${attempt.label}` : ''} · {formatDateTime(attempt.finishedAt)}
            </p>
            <h1 id="result-title" className={`mt-1 flex items-center gap-2 text-3xl font-extrabold ${attempt.passed ? 'text-ok' : 'text-bad'}`}>
              <Icon name={attempt.passed ? 'check' : 'x'} className="size-7" />
              {attempt.passed ? t('results.passed') : t('results.failed')}
            </h1>
            <p className="mt-1 text-muted">{t('results.passMark', { percent: PASS_PERCENT })}</p>
            <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl bg-surface2 p-3">
                <dt className="text-xs font-semibold text-muted">{t('results.score')}</dt>
                <dd className="text-xl font-extrabold tabular-nums">
                  {attempt.correct}/{attempt.total}
                </dd>
              </div>
              <div className="rounded-xl bg-surface2 p-3">
                <dt className="text-xs font-semibold text-muted">{t('results.percent')}</dt>
                <dd className="text-xl font-extrabold tabular-nums">{formatPercent(attempt.percent)}</dd>
              </div>
              <div className="rounded-xl bg-surface2 p-3" title={t('results.scaled.help', { pass: PASS_SCALED })}>
                <dt className="text-xs font-semibold text-muted">{t('results.scaled')}</dt>
                <dd className="text-xl font-extrabold tabular-nums">
                  ~{attempt.scaled}
                  <span className="ml-1 text-xs font-semibold text-muted">/ 1000</span>
                </dd>
              </div>
              <div className="rounded-xl bg-surface2 p-3">
                <dt className="text-xs font-semibold text-muted">{t('results.time')}</dt>
                <dd className="text-xl font-extrabold tabular-nums">{formatDuration(attempt.durationMs)}</dd>
              </div>
            </dl>
            <p className="mt-2 text-xs text-muted">{t('results.scaled.note', { pass: PASS_SCALED })}</p>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-2 border-t border-line pt-5 print:hidden">
          <button type="button" className="btn-primary" disabled={missed.length === 0} onClick={retry}>
            <Icon name="refresh" className="size-4" />
            {tn('results.retryMissed', missed.length)}
          </button>
          <a href="#/setup" className="btn-secondary">
            <Icon name="play" className="size-4" />
            {t('results.newQuiz')}
          </a>
          <button type="button" className="btn-secondary" onClick={() => downloadJson(`pl300-result-${new Date(attempt.finishedAt).toISOString().slice(0, 10)}.json`, buildExport(attempt, questionsById))}>
            <Icon name="download" className="size-4" />
            {t('results.exportJson')}
          </button>
          <button type="button" className="btn-secondary" onClick={print}>
            <Icon name="print" className="size-4" />
            {t('results.print')}
          </button>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5 sm:p-6" aria-labelledby="dom-title">
          <h2 id="dom-title" className="text-lg font-bold">
            {t('results.domains')}
          </h2>
          <div className="mt-4">
            <DomainBars rows={rows} />
          </div>
          <p className="mt-4 text-xs text-muted">{t('results.domains.note', { percent: PASS_PERCENT })}</p>
        </section>

        <section className="card p-5 sm:p-6" aria-labelledby="weak-title">
          <h2 id="weak-title" className="text-lg font-bold">
            {t('results.weak')}
          </h2>
          {weak.length === 0 ? (
            <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-ok">
              <Icon name="check" className="size-4" />
              {t('results.weak.none')}
            </p>
          ) : (
            <ul className="mt-4 space-y-2.5">
              {weak.slice(0, 8).map((w) => (
                <li key={w.topic} className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <DomainBadge domain={w.domain} />
                    <span className="truncate font-medium">{w.topic}</span>
                  </span>
                  <span className="shrink-0 font-semibold text-bad tabular-nums">
                    {w.correct}/{w.total} · {formatPercent(w.percent)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* review */}
      <section aria-labelledby="review-title">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <h2 id="review-title" className="text-lg font-bold">
            {t('results.review')}
          </h2>
          <button type="button" className="btn-ghost min-h-9 text-xs" onClick={() => setExpandAll((v) => !v)}>
            {expandAll ? t('results.collapseAll') : t('results.expandAll')}
          </button>
        </div>
        <div role="group" aria-label={t('results.filter')} className="mb-4 flex flex-wrap gap-2 print:hidden">
          {(['all', 'wrong', 'correct', 'flagged', 'unanswered'] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={`chip min-h-9 cursor-pointer px-3.5 text-sm ${filter === f ? 'border-accent bg-accent text-accent-ink' : 'hover:bg-line/60'}`}
            >
              {t(`filter.${f}` as 'filter.all')} <span className="tabular-nums opacity-70">{counts[f]}</span>
            </button>
          ))}
        </div>
        {visible.length === 0 ? (
          <p className="card p-6 text-center text-sm text-muted">{t('results.review.empty')}</p>
        ) : (
          <ol className="space-y-3">
            {visible.map(({ r, i }) => (
              <ReviewItem key={`${r.id}-${expandAll}`} index={i} result={r} attempt={attempt} forceOpen={expandAll} />
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}

function ReviewItem({ index, result, attempt, forceOpen }: { index: number; result: QuestionResult; attempt: Attempt; forceOpen: boolean }) {
  const q = questionsById.get(result.id)
  if (!q) return null
  const study = q.caseId ? casesById.get(q.caseId) : undefined
  const order = attempt.optionOrder[q.id] ?? q.options.map((o) => o.key)
  const status = !result.answered ? 'unanswered' : result.correct ? 'correct' : 'wrong'
  const tone = {
    correct: { icon: 'check' as const, cls: 'bg-ok-bg text-ok', label: t('review.correct') },
    wrong: { icon: 'x' as const, cls: 'bg-bad-bg text-bad', label: t('review.wrong') },
    unanswered: { icon: 'alert' as const, cls: 'bg-warn-bg text-warn', label: t('review.unanswered') },
  }[status]
  const letters = (keys: string[]) =>
    keys
      .map((k) => String.fromCharCode(65 + Math.max(0, order.indexOf(k))))
      .sort()
      .join(', ')

  return (
    <li>
      <details open={forceOpen} className="card overflow-hidden">
        <summary className="flex cursor-pointer items-start gap-3 p-4 hover:bg-surface2">
          <span className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-full ${tone.cls}`}>
            <Icon name={tone.icon} className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-bold text-muted">{t('review.q', { n: index + 1 })}</span>
              <DomainBadge domain={q.domain} />
              <span className="text-muted">{q.topic}</span>
              <span className={`font-bold ${tone.cls.split(' ')[1]}`}>{tone.label}</span>
              {result.flagged && (
                <span className="inline-flex items-center gap-1 font-semibold text-accent-ink dark:text-accent">
                  <Icon name="flag" className="size-3.5" />
                  {t('nav.flagged')}
                </span>
              )}
            </span>
            <span className="mt-1 line-clamp-2 block text-[15px] font-medium print:line-clamp-none">{q.stem.split('\n\n')[0]}</span>
          </span>
          <Icon name="down" className="mt-1 size-4 shrink-0 text-muted" />
        </summary>
        <div className="space-y-4 border-t border-line p-4 sm:p-5">
          {study && <CasePanel study={study} />}
          <QuestionStem question={q} id={`rv-${q.id}`} />
          <OptionList question={q} order={order} selected={result.selected} reveal disabled labelledBy={`rv-${q.id}`} />
          <p className="text-sm">
            <span className="font-semibold">{t('review.yourAnswer')}:</span> {result.answered ? letters(result.selected) : t('review.none')}
            <span className="mx-2 text-muted">·</span>
            <span className="font-semibold">{t('review.correctAnswer')}:</span> {letters(q.correct)}
          </p>
          <ExplanationPanel question={q} />
        </div>
      </details>
    </li>
  )
}
