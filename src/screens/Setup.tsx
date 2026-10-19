import { useEffect, useMemo, useRef, useState } from 'react'
import { DistributionPreview } from '../components/charts'
import { Dialog, Icon, Switch } from '../components/ui'
import { bank, bankStats, domainCounts } from '../data/bank'
import { t, tn } from '../i18n'
import { defaultConfig } from '../lib/config'
import { distribute } from '../lib/distribution'
import { formatDuration } from '../lib/format'
import { useRoute } from '../lib/router'
import { candidatePool, countMissed, poolByDomain } from '../lib/select'
import { useApp } from '../state/AppState'
import type { Mode, QuizConfig, Source } from '../types'

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="card p-5 sm:p-6">
      <h2 className="text-base font-bold">{title}</h2>
      {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}

function ChoiceCard({
  selected,
  onSelect,
  title,
  body,
  icon,
  disabled,
}: {
  selected: boolean
  onSelect: () => void
  title: string
  body: string
  icon: 'bolt' | 'clock' | 'list' | 'target' | 'refresh'
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={`flex w-full cursor-pointer items-start gap-3 rounded-xl border-2 p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
        selected ? 'border-accent bg-accent/10' : 'border-line hover:bg-surface2'
      }`}
    >
      <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${selected ? 'bg-accent text-accent-ink' : 'bg-surface2 text-muted'}`}>
        <Icon name={icon} className="size-4.5" />
      </span>
      <span>
        <span className="block font-bold">{title}</span>
        <span className="mt-0.5 block text-sm text-muted">{body}</span>
      </span>
    </button>
  )
}

function initialConfig(saved: QuizConfig | null, query: URLSearchParams): QuizConfig {
  const requested = query.get('mode')
  const mode: Mode = requested === 'exam' || requested === 'practice' ? requested : (saved?.mode ?? 'practice')
  const base = saved ? { ...defaultConfig(mode), ...saved, mode } : defaultConfig(mode)
  if (requested === 'exam' || requested === 'practice') base.timerEnabled = mode === 'exam'
  const source = query.get('source') as Source | null
  if (source === 'weak' || source === 'wrong' || source === 'standard') base.source = source
  else if (base.source === 'wrong') base.source = 'standard'
  base.domains = base.domains.filter((d) => bank.domains.includes(d))
  if (base.domains.length === 0) base.domains = [...bank.domains]
  return base
}

export function Setup() {
  const { setupDefaults, stats, lastAttempt, startQuiz, rememberSetup, session } = useApp()
  const route = useRoute()
  const [confirmReplace, setConfirmReplace] = useState(false)
  const [cfg, setCfg] = useState<QuizConfig>(() => initialConfig(setupDefaults, route.query))
  const patch = (p: Partial<QuizConfig>) => setCfg((c) => ({ ...c, ...p }))

  const missedInLast = lastAttempt ? lastAttempt.results.filter((r) => !r.correct).length : 0
  const pool = useMemo(() => candidatePool(bank, cfg, { stats, lastAttempt }), [cfg, stats, lastAttempt])
  const poolSize = pool.length
  const missedInPool = useMemo(() => countMissed(pool, stats), [pool, stats])
  const count = poolSize === 0 ? 0 : Math.min(Math.max(cfg.count, 1), poolSize)
  const counts = useMemo(
    () => distribute(count, poolByDomain(pool, cfg.domains)),
    [pool, cfg.domains, count],
  )
  const available = domainCounts()

  // --- number input kept as text so it can be cleared while typing ---
  const [text, setText] = useState(String(count))
  const typing = useRef(false)
  useEffect(() => {
    if (!typing.current) setText(String(count))
  }, [count])
  const onNumber = (raw: string) => {
    typing.current = true
    setText(raw)
    const n = parseInt(raw, 10)
    if (!Number.isNaN(n)) {
      const clamped = Math.max(1, Math.min(n, poolSize))
      patch({ count: clamped })
      if (n > poolSize) setText(String(clamped))
    }
  }

  const allSelected = cfg.domains.length === bank.domains.length
  const toggleDomain = (d: string) => {
    const has = cfg.domains.includes(d)
    if (has && cfg.domains.length === 1) return // keep at least one
    patch({ domains: bank.domains.filter((x) => (x === d ? !has : cfg.domains.includes(x))) })
  }

  const presets = [10, 25, 50].filter((n) => n < poolSize)
  const totalSeconds = cfg.secondsPerQuestion * count

  const setMode = (mode: Mode) => patch({ mode, timerEnabled: mode === 'exam' })

  const launch = () => {
    const finalConfig = { ...cfg, count }
    rememberSetup(finalConfig)
    startQuiz(finalConfig, cfg.source === 'weak' ? { label: t('label.weak') } : cfg.source === 'wrong' ? { label: t('label.retryMissed') } : {})
  }
  // Starting a new quiz replaces an unfinished one, so ask first.
  const start = () => (session ? setConfirmReplace(true) : launch())

  return (
    <div className="rise mx-auto max-w-3xl space-y-5 pb-16">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{t('setup.title')}</h1>
        <p className="mt-1 text-muted">{t('setup.subtitle')}</p>
      </div>

      <Section title={t('setup.mode')}>
        <div role="radiogroup" aria-label={t('setup.mode')} className="grid gap-3 sm:grid-cols-2">
          <ChoiceCard selected={cfg.mode === 'practice'} onSelect={() => setMode('practice')} icon="bolt" title={t('mode.practice')} body={t('mode.practice.desc')} />
          <ChoiceCard selected={cfg.mode === 'exam'} onSelect={() => setMode('exam')} icon="clock" title={t('mode.exam')} body={t('mode.exam.desc')} />
        </div>
      </Section>

      <Section title={t('setup.source')}>
        <div role="radiogroup" aria-label={t('setup.source')} className="grid gap-3 sm:grid-cols-3">
          <ChoiceCard selected={cfg.source === 'standard'} onSelect={() => patch({ source: 'standard' })} icon="list" title={t('source.standard')} body={t('source.standard.desc')} />
          <ChoiceCard selected={cfg.source === 'weak'} onSelect={() => patch({ source: 'weak' })} icon="target" title={t('source.weak')} body={t('source.weak.desc')} />
          <ChoiceCard
            selected={cfg.source === 'wrong'}
            onSelect={() => patch({ source: 'wrong' })}
            icon="refresh"
            title={t('source.wrong')}
            body={missedInLast > 0 ? tn('source.wrong.desc', missedInLast) : t('source.wrong.none')}
            disabled={missedInLast === 0}
          />
        </div>
      </Section>

      <Section title={t('setup.scope')} hint={t('setup.scope.hint')}>
        <div className="space-y-2">
          <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 hover:bg-surface2">
            <input
              type="checkbox"
              className="size-5 accent-[var(--accent)]"
              checked={allSelected}
              ref={(el) => {
                if (el) el.indeterminate = !allSelected
              }}
              onChange={() => patch({ domains: allSelected ? [bank.domains[0]] : [...bank.domains] })}
            />
            <span className="font-semibold">{t('setup.allDomains')}</span>
            <span className="ml-auto text-sm text-muted tabular-nums">{tn('home.domains.count', bankStats.questions)}</span>
          </label>
          <div className="ml-2 border-l border-line pl-3">
            {bank.domains.map((d) => (
              <label key={d} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 hover:bg-surface2">
                <input
                  type="checkbox"
                  className="size-5 accent-[var(--accent)]"
                  checked={cfg.domains.includes(d)}
                  onChange={() => toggleDomain(d)}
                />
                <span>{d}</span>
                <span className="ml-auto text-sm text-muted tabular-nums">{tn('home.domains.count', available[d])}</span>
              </label>
            ))}
          </div>
        </div>
      </Section>

      <Section title={t('setup.count')} hint={poolSize > 0 ? t('setup.count.hint', { max: poolSize }) : undefined}>
        {poolSize === 0 ? (
          <p className="flex items-center gap-2 rounded-lg bg-warn-bg p-3 text-sm font-semibold text-warn">
            <Icon name="alert" className="size-4" />
            {t('setup.empty')}
          </p>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-4">
              <input
                type="range"
                min={1}
                max={poolSize}
                value={count}
                aria-label={t('setup.count')}
                onChange={(e) => {
                  typing.current = false
                  patch({ count: Number(e.target.value) })
                }}
                className="h-2 min-w-48 flex-1 cursor-pointer accent-[var(--accent)]"
              />
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={poolSize}
                value={text}
                aria-label={t('setup.count.input')}
                onChange={(e) => onNumber(e.target.value)}
                onBlur={() => {
                  typing.current = false
                  setText(String(count))
                }}
                className="h-11 w-24 rounded-xl border border-line bg-surface px-3 text-center text-lg font-bold tabular-nums"
              />
            </div>
            <div className="flex flex-wrap gap-2" role="group" aria-label={t('setup.presets')}>
              {presets.map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-pressed={count === n}
                  onClick={() => {
                    typing.current = false
                    patch({ count: n })
                  }}
                  className={`chip min-h-9 cursor-pointer px-4 text-sm ${count === n ? 'border-accent bg-accent text-accent-ink' : 'hover:bg-line/60'}`}
                >
                  {n}
                </button>
              ))}
              <button
                type="button"
                aria-pressed={count === poolSize}
                onClick={() => {
                  typing.current = false
                  patch({ count: poolSize })
                }}
                className={`chip min-h-9 cursor-pointer px-4 text-sm ${count === poolSize ? 'border-accent bg-accent text-accent-ink' : 'hover:bg-line/60'}`}
              >
                {t('setup.all')}
              </button>
            </div>
            <div aria-live="polite">
              <p className="mb-2 text-sm font-semibold">{cfg.source === 'weak' ? t('setup.preview.weak') : t('setup.preview')}</p>
              {cfg.source === 'weak' ? (
                <p className="text-sm text-muted">
                  {missedInPool === 0
                    ? t('setup.preview.weak.none')
                    : tn('setup.preview.weak.body', count, { missed: Math.min(missedInPool, count) })}
                </p>
              ) : (
                <DistributionPreview counts={counts} domains={cfg.domains} />
              )}
            </div>
          </div>
        )}
      </Section>

      <Section title={t('setup.options')}>
        <div className="divide-y divide-line">
          <Switch checked={cfg.shuffleQuestions} onChange={(v) => patch({ shuffleQuestions: v })} label={t('opt.shuffleQuestions')} description={t('opt.shuffleQuestions.desc')} />
          <Switch checked={cfg.shuffleOptions} onChange={(v) => patch({ shuffleOptions: v })} label={t('opt.shuffleOptions')} description={t('opt.shuffleOptions.desc')} />
          {bankStats.cases > 0 && (
            <Switch checked={cfg.includeCases} onChange={(v) => patch({ includeCases: v })} label={t('opt.cases')} description={t('opt.cases.desc')} />
          )}
          <div>
            <Switch checked={cfg.timerEnabled} onChange={(v) => patch({ timerEnabled: v })} label={t('opt.timer')} description={t('opt.timer.desc')} />
            {cfg.timerEnabled && (
              <div className="mb-2 flex flex-wrap items-center gap-3 rounded-xl bg-surface2 p-3 text-sm">
                <label htmlFor="secs" className="font-semibold">
                  {t('opt.timer.perQuestion')}
                </label>
                <input
                  id="secs"
                  type="number"
                  min={10}
                  max={900}
                  step={5}
                  value={cfg.secondsPerQuestion}
                  onChange={(e) => patch({ secondsPerQuestion: Math.max(10, Math.min(900, Number(e.target.value) || 100)) })}
                  className="h-10 w-24 rounded-lg border border-line bg-surface px-2 text-center font-bold tabular-nums"
                />
                <span className="text-muted">
                  ({formatDuration(cfg.secondsPerQuestion * 1000)}) · {t('opt.timer.total', { time: formatDuration(totalSeconds * 1000) })}
                </span>
              </div>
            )}
          </div>
        </div>
      </Section>

      <div className="sticky bottom-3 z-10 flex justify-end">
        <button type="button" className="btn-primary min-h-12 px-8 text-base shadow-soft" disabled={count === 0} onClick={start}>
          <Icon name="play" className="size-4" />
          {t(cfg.mode === 'exam' ? 'setup.start.exam' : 'setup.start.practice', { count })}
        </button>
      </div>

      <Dialog
        open={confirmReplace}
        onClose={() => setConfirmReplace(false)}
        title={t('setup.replace.title')}
        actions={
          <>
            <button type="button" className="btn-secondary" onClick={() => setConfirmReplace(false)}>
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setConfirmReplace(false)
                launch()
              }}
            >
              {t('setup.replace.confirm')}
            </button>
          </>
        }
      >
        {t('setup.replace.body')}
      </Dialog>
    </div>
  )
}
