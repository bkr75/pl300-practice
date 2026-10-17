import { useMemo, useState } from 'react'
import { DomainBars, ScoreLine } from '../components/charts'
import { DomainBadge, Dialog, Icon } from '../components/ui'
import { bank, bankStats, questionsById } from '../data/bank'
import { t, tn } from '../i18n'
import { formatDateTime, formatDuration, formatPercent } from '../lib/format'
import { navigate } from '../lib/router'
import { PASS_PERCENT, domainAccuracy, percentOf } from '../lib/scoring'
import { useApp } from '../state/AppState'

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-semibold text-muted">{label}</p>
      <p className="mt-1 text-2xl font-extrabold tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
    </div>
  )
}

export function History() {
  const { history, stats, resetAll } = useApp()
  const [confirmReset, setConfirmReset] = useState(false)

  const kpis = useMemo(() => {
    const best = history.reduce((m, a) => Math.max(m, a.percent), 0)
    const avg = history.length ? history.reduce((s, a) => s + a.percent, 0) / history.length : 0
    const passRate = percentOf(history.filter((a) => a.passed).length, history.length)
    const seen = Object.keys(stats).length
    const mastered = Object.values(stats).filter((s) => s.lastCorrect).length
    return { best, avg, passRate, seen, mastered }
  }, [history, stats])

  const acc = useMemo(() => domainAccuracy(bank.questions, stats), [stats])
  const rows = bank.domains.map((d) => ({ domain: d, correct: acc[d]?.correct ?? 0, total: acc[d]?.attempts ?? 0 }))

  const weakTopics = useMemo(() => {
    const topics = new Map<string, { topic: string; domain: string; attempts: number; correct: number }>()
    for (const [id, s] of Object.entries(stats)) {
      const q = questionsById.get(id)
      if (!q) continue
      const e = topics.get(q.topic) ?? { topic: q.topic, domain: q.domain, attempts: 0, correct: 0 }
      e.attempts += s.attempts
      e.correct += s.correct
      topics.set(q.topic, e)
    }
    return [...topics.values()]
      .map((e) => ({ ...e, percent: percentOf(e.correct, e.attempts) }))
      .filter((e) => e.percent < PASS_PERCENT)
      .sort((a, b) => a.percent - b.percent || b.attempts - a.attempts)
      .slice(0, 6)
  }, [stats])

  if (history.length === 0) {
    return (
      <div className="rise card mx-auto max-w-xl p-10 text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-accent text-accent-ink">
          <Icon name="history" className="size-7" />
        </span>
        <h1 className="mt-4 text-xl font-extrabold">{t('history.empty.title')}</h1>
        <p className="mt-2 text-muted">{t('history.empty.body')}</p>
        <button type="button" className="btn-primary mt-6" onClick={() => navigate('/setup')}>
          {t('history.empty.cta')}
        </button>
      </div>
    )
  }

  return (
    <div className="rise space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{t('history.title')}</h1>
          <p className="mt-1 text-muted">{t('history.subtitle')}</p>
        </div>
        <button type="button" className="btn-secondary" onClick={() => navigate('/setup?source=weak')}>
          <Icon name="target" className="size-4" />
          {t('history.weakQuiz')}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label={t('history.kpi.attempts')} value={String(history.length)} />
        <Kpi label={t('history.kpi.best')} value={formatPercent(kpis.best)} />
        <Kpi label={t('history.kpi.avg')} value={formatPercent(kpis.avg)} sub={t('history.kpi.passRate', { rate: formatPercent(kpis.passRate) })} />
        <Kpi label={t('history.kpi.mastered')} value={`${kpis.mastered}/${bankStats.questions}`} sub={t('history.kpi.seen', { seen: kpis.seen })} />
      </div>

      <section className="card p-5 sm:p-6" aria-labelledby="trend-title">
        <h2 id="trend-title" className="text-lg font-bold">
          {t('history.trend')}
        </h2>
        <div className="mt-3">
          <ScoreLine attempts={history} />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5 sm:p-6" aria-labelledby="acc-title">
          <h2 id="acc-title" className="text-lg font-bold">
            {t('history.domainAccuracy')}
          </h2>
          <p className="mt-1 mb-4 text-sm text-muted">{t('history.domainAccuracy.hint')}</p>
          <DomainBars rows={rows} />
        </section>
        <section className="card p-5 sm:p-6" aria-labelledby="wk-title">
          <h2 id="wk-title" className="text-lg font-bold">
            {t('history.weak')}
          </h2>
          {weakTopics.length === 0 ? (
            <p className="mt-4 text-sm text-muted">{t('history.weak.none')}</p>
          ) : (
            <ul className="mt-4 space-y-2.5">
              {weakTopics.map((w) => (
                <li key={w.topic} className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <DomainBadge domain={w.domain} />
                    <span className="truncate font-medium">{w.topic}</span>
                  </span>
                  <span className="shrink-0 font-semibold text-bad tabular-nums">{formatPercent(w.percent)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="card overflow-hidden" aria-labelledby="att-title">
        <h2 id="att-title" className="p-5 text-lg font-bold sm:px-6">
          {t('history.attempts')}
        </h2>
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <thead className="border-y border-line bg-surface2 text-xs text-muted uppercase">
              <tr>
                <th scope="col" className="px-5 py-2.5 font-semibold sm:px-6">{t('history.col.date')}</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">{t('history.col.mode')}</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">{t('history.col.score')}</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">{t('history.col.result')}</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">{t('history.col.time')}</th>
                <th scope="col" className="px-5 py-2.5 sm:px-6"><span className="sr-only">{t('history.col.review')}</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {history.map((a) => (
                <tr key={a.id} className="hover:bg-surface2">
                  <td className="px-5 py-3 sm:px-6">{formatDateTime(a.finishedAt)}</td>
                  <td className="px-3 py-3">
                    {t(a.mode === 'exam' ? 'mode.exam' : 'mode.practice')}
                    {a.label && <span className="block text-xs text-muted">{a.label}</span>}
                  </td>
                  <td className="px-3 py-3 font-semibold tabular-nums">
                    {a.correct}/{a.total} · {formatPercent(a.percent)}
                  </td>
                  <td className="px-3 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${a.passed ? 'bg-ok-bg text-ok' : 'bg-bad-bg text-bad'}`}>
                      {a.passed ? t('history.passed') : t('history.failed')}
                    </span>
                  </td>
                  <td className="px-3 py-3 tabular-nums">{formatDuration(a.durationMs)}</td>
                  <td className="px-5 py-3 text-right sm:px-6">
                    <a href={`#/results/${a.id}`} className="font-semibold text-info underline-offset-2 hover:underline">
                      {t('history.review')}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card flex flex-wrap items-center justify-between gap-4 border-bad-line p-5">
        <div>
          <h2 className="font-bold">{t('reset.title')}</h2>
          <p className="text-sm text-muted">{tn('reset.body', history.length)}</p>
        </div>
        <button type="button" className="btn-danger" onClick={() => setConfirmReset(true)}>
          <Icon name="trash" className="size-4" />
          {t('reset.button')}
        </button>
      </section>

      <Dialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title={t('reset.confirm.title')}
        actions={
          <>
            <button type="button" className="btn-secondary" onClick={() => setConfirmReset(false)}>
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className="btn-danger"
              onClick={() => {
                setConfirmReset(false)
                resetAll()
              }}
            >
              {t('reset.confirm.yes')}
            </button>
          </>
        }
      >
        {t('reset.confirm.body')}
      </Dialog>
    </div>
  )
}
