import { useState } from 'react'
import { ScoreRing } from '../components/charts'
import { Dialog, DomainBadge, Icon } from '../components/ui'
import { bank, bankStats, domainCounts, questionsById } from '../data/bank'
import { t, tn } from '../i18n'
import { defaultConfig } from '../lib/config'
import { formatDateTime } from '../lib/format'
import { navigate } from '../lib/router'
import { useApp } from '../state/AppState'

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
      <div className="text-2xl font-extrabold text-accent tabular-nums">{value}</div>
      <div className="text-xs font-medium text-white/70">{label}</div>
    </div>
  )
}

export function Home() {
  const { session, lastAttempt, startQuiz, abandon, history } = useApp()
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const total = bankStats.questions
  const counts = domainCounts()

  const quick = [
    {
      icon: 'bolt' as const,
      title: t('home.quick.practice.title'),
      body: tn('home.quick.practice.body', Math.min(10, total)),
      run: () => startQuiz(defaultConfig('practice', { count: Math.min(10, total) })),
    },
    {
      icon: 'clock' as const,
      title: t('home.quick.exam.title'),
      body: tn('home.quick.exam.body', Math.min(50, total)),
      run: () => startQuiz(defaultConfig('exam', { count: Math.min(50, total) })),
    },
    {
      icon: 'target' as const,
      title: t('home.quick.weak.title'),
      body: t('home.quick.weak.body'),
      run: () => startQuiz(defaultConfig('practice', { source: 'weak', count: Math.min(10, total) }), { label: t('label.weak') }),
    },
  ]

  const missed = lastAttempt ? lastAttempt.results.filter((r) => !r.correct) : []

  return (
    <div className="rise space-y-8">
      {session && (
        <section aria-label={t('home.resume.title')} className="card flex flex-wrap items-center justify-between gap-4 border-accent p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-xl bg-accent/20 text-accent-ink dark:text-accent">
              <Icon name="play" />
            </span>
            <div>
              <p className="font-bold">{t('home.resume.title')}</p>
              <p className="text-sm text-muted">
                {t(session.config.mode === 'exam' ? 'mode.exam' : 'mode.practice')} ·{' '}
                {t('home.resume.progress', { current: session.index + 1, total: session.questionIds.length })}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn-ghost" onClick={() => setConfirmDiscard(true)}>
              {t('home.resume.discard')}
            </button>
            <button type="button" className="btn-primary" onClick={() => navigate('/quiz')}>
              {t('home.resume.continue')}
            </button>
          </div>
        </section>
      )}

      <section className="relative overflow-hidden rounded-3xl bg-navy p-6 text-white shadow-soft sm:p-10">
        <div className="pointer-events-none absolute -top-24 -right-24 size-80 rounded-full bg-accent/20 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute right-8 bottom-6 hidden items-end gap-2 opacity-90 md:flex" aria-hidden="true">
          {[40, 64, 52, 88, 112].map((h, i) => (
            <div key={i} className="w-7 rounded-md bg-accent" style={{ height: h, opacity: 0.25 + i * 0.18 }} />
          ))}
        </div>
        <div className="relative max-w-2xl">
          <span className="chip border-white/20 bg-white/10 text-white">{t('home.hero.badge')}</span>
          <h1 className="mt-4 text-3xl leading-tight font-extrabold tracking-tight sm:text-5xl">
            {t('home.hero.title1')} <span className="text-accent">{t('home.hero.title2')}</span>
          </h1>
          <p className="mt-4 text-base text-white/75 sm:text-lg">{t('home.hero.subtitle')}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" className="btn-primary" onClick={() => navigate('/setup')}>
              <Icon name="play" className="size-4" />
              {t('home.hero.cta')}
            </button>
            <button type="button" className="btn border border-white/25 text-white hover:bg-white/10" onClick={() => navigate('/history')}>
              <Icon name="history" className="size-4" />
              {t('home.hero.progress')}
            </button>
          </div>
        </div>
        <dl className="relative mt-8 grid max-w-xl grid-cols-3 gap-3">
          <Stat value={bankStats.questions} label={t('home.stats.questions')} />
          <Stat value={bankStats.domains} label={t('home.stats.domains')} />
          {bankStats.cases > 0 ? (
            <Stat value={bankStats.cases} label={t('home.stats.cases')} />
          ) : (
            <Stat value={bankStats.multi} label={t('home.stats.multi')} />
          )}
        </dl>
      </section>

      <section aria-labelledby="quick-title">
        <h2 id="quick-title" className="mb-3 text-lg font-bold">
          {t('home.quick.title')}
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {quick.map((q) => (
            <button
              key={q.title}
              type="button"
              onClick={q.run}
              className="card group cursor-pointer p-5 text-left transition duration-150 hover:-translate-y-0.5 hover:border-accent"
            >
              <span className="grid size-10 place-items-center rounded-xl bg-accent text-accent-ink">
                <Icon name={q.icon} />
              </span>
              <span className="mt-4 block text-base font-bold">{q.title}</span>
              <span className="mt-1 block text-sm text-muted">{q.body}</span>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-info">
                {t('home.quick.start')}
                <Icon name="right" className="size-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </button>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5 sm:p-6" aria-labelledby="domains-title">
          <h2 id="domains-title" className="text-lg font-bold">
            {t('home.domains.title')}
          </h2>
          <ul className="mt-4 space-y-3">
            {bank.domains.map((d) => (
              <li key={d} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2.5">
                  <DomainBadge domain={d} />
                  <span className="text-sm">{d}</span>
                </span>
                <span className="text-sm font-semibold text-muted tabular-nums">{tn('home.domains.count', counts[d])}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="card p-5 sm:p-6" aria-labelledby="last-title">
          <h2 id="last-title" className="text-lg font-bold">
            {t('home.last.title')}
          </h2>
          {lastAttempt ? (
            <div className="mt-4 flex flex-wrap items-center gap-5">
              <ScoreRing percent={lastAttempt.percent} passed={lastAttempt.passed} size={112} />
              <div className="min-w-0 flex-1 space-y-1 text-sm">
                <p className={`font-bold ${lastAttempt.passed ? 'text-ok' : 'text-bad'}`}>
                  {lastAttempt.passed ? t('results.passed') : t('results.failed')}
                </p>
                <p>
                  {t('home.last.score', { correct: lastAttempt.correct, total: lastAttempt.total })} ·{' '}
                  {t(lastAttempt.mode === 'exam' ? 'mode.exam' : 'mode.practice')}
                </p>
                <p className="text-muted">{formatDateTime(lastAttempt.finishedAt)}</p>
                <div className="flex flex-wrap gap-2 pt-2">
                  <button type="button" className="btn-secondary min-h-9 text-xs" onClick={() => navigate(`/results/${lastAttempt.id}`)}>
                    {t('home.last.review')}
                  </button>
                  {missed.length > 0 && (
                    <button
                      type="button"
                      className="btn-secondary min-h-9 text-xs"
                      onClick={() =>
                        startQuiz(defaultConfig('practice', { count: missed.length }), {
                          questions: missed.flatMap((r) => questionsById.get(r.id) ?? []),
                          label: t('label.retryMissed'),
                        })
                      }
                    >
                      <Icon name="refresh" className="size-3.5" />
                      {tn('results.retryMissed', missed.length)}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted">{t('home.last.empty')}</p>
          )}
          {history.length > 1 && (
            <p className="mt-4 border-t border-line pt-3 text-xs text-muted">{tn('home.last.total', history.length)}</p>
          )}
        </section>
      </div>

      <Dialog
        open={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        title={t('home.discard.title')}
        actions={
          <>
            <button type="button" className="btn-secondary" onClick={() => setConfirmDiscard(false)}>
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className="btn-danger"
              onClick={() => {
                setConfirmDiscard(false)
                abandon()
              }}
            >
              {t('home.discard.confirm')}
            </button>
          </>
        }
      >
        {t('home.discard.body')}
      </Dialog>
    </div>
  )
}
