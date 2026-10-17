import { useEffect, useMemo, useRef, useState } from 'react'
import { CasePanel, ExplanationPanel, OptionList, QuestionNav, QuestionStem, type NavState } from '../components/question'
import { DomainBadge, Dialog, Icon, ProgressBar } from '../components/ui'
import { casesById, questionsById } from '../data/bank'
import { t, tn } from '../i18n'
import { formatDuration } from '../lib/format'
import { navigate } from '../lib/router'
import { isCorrect } from '../lib/scoring'
import { useApp } from '../state/AppState'
import type { Question, Session } from '../types'

export function Quiz() {
  const { session } = useApp()
  useEffect(() => {
    if (!session) navigate('/')
  }, [session])
  if (!session) return null
  return <QuizInner session={session} />
}

function QuizInner({ session }: { session: Session }) {
  const app = useApp()
  const { answer, check, toggleFlag, goTo, tick, finish } = app
  const [finishOpen, setFinishOpen] = useState(false)

  const questions = useMemo(() => session.questionIds.map((id) => questionsById.get(id)!), [session.questionIds])
  const total = questions.length
  const q: Question = questions[session.index]
  const isPractice = session.config.mode === 'practice'
  const selected = session.answers[q.id] ?? []
  const checked = !!session.checked[q.id]
  const reveal = isPractice && checked
  const order = session.optionOrder[q.id] ?? q.options.map((o) => o.key)
  const isLast = session.index === total - 1
  const studyCase = q.caseId ? casesById.get(q.caseId) : undefined

  const answeredCount = questions.filter((x) => (session.answers[x.id]?.length ?? 0) > 0).length
  const unanswered = questions.map((x, i) => ({ x, i })).filter(({ x }) => (session.answers[x.id]?.length ?? 0) === 0)
  const flaggedCount = questions.filter((x) => session.flagged[x.id]).length

  // Start each question at the top of the page.
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [session.index])

  /* ---------- timer: counts visible time only, auto-finishes on expiry ---------- */
  useEffect(() => {
    let last = Date.now()
    const id = window.setInterval(() => {
      const now = Date.now()
      if (!document.hidden) tick(Math.min(now - last, 60_000))
      last = now
    }, 1000)
    return () => window.clearInterval(id)
  }, [tick])

  const limitMs = session.config.timerEnabled ? session.config.secondsPerQuestion * 1000 * total : null
  const remainingMs = limitMs === null ? null : Math.max(0, limitMs - session.elapsedMs)
  const expired = useRef(false)
  useEffect(() => {
    if (remainingMs === 0 && !expired.current) {
      expired.current = true
      finish()
    }
  }, [remainingMs, finish])

  /* ---------- actions ---------- */
  const toggleOption = (key: string) => {
    if (reveal) return
    if (q.type === 'single') answer(q.id, [key])
    else answer(q.id, selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key])
  }

  const requestFinish = () => {
    if (isPractice && unanswered.length === 0) finish()
    else setFinishOpen(true)
  }

  const next = () => (isLast ? requestFinish() : goTo(session.index + 1))
  const primary = () => {
    if (isPractice) {
      if (!checked) {
        if (selected.length > 0) check(q.id)
      } else next()
    } else next()
  }

  // Re-bound after every render so the handler always sees the current question.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || finishOpen) return
      const target = e.target as HTMLElement
      const tag = target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) return
      const k = e.key
      if (/^[a-eA-E]$/.test(k)) {
        const key = order[k.toUpperCase().charCodeAt(0) - 65]
        if (key) toggleOption(key)
        e.preventDefault()
      } else if (k === 'Enter') {
        // let focused buttons/links keep their native Enter behaviour (options excepted)
        if (!target.hasAttribute('data-option') && (tag === 'BUTTON' || tag === 'A' || tag === 'SUMMARY')) return
        e.preventDefault()
        primary()
      } else if (k === 'ArrowRight') {
        e.preventDefault()
        if (!isLast) goTo(session.index + 1)
      } else if (k === 'ArrowLeft') {
        e.preventDefault()
        if (session.index > 0) goTo(session.index - 1)
      } else if (k === 'f' || k === 'F') {
        e.preventDefault()
        toggleFlag(q.id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const stateOf = (id: string): NavState => {
    const x = questionsById.get(id)!
    const sel = session.answers[id] ?? []
    if (isPractice && session.checked[id]) return isCorrect(x, sel) ? 'correct' : 'wrong'
    return sel.length > 0 ? 'answered' : 'unanswered'
  }

  const primaryLabel = isPractice
    ? !checked
      ? t('quiz.check')
      : isLast
        ? t('quiz.finishQuiz')
        : t('quiz.next')
    : isLast
      ? t('quiz.finishExam')
      : t('quiz.next')

  const lowTime = remainingMs !== null && remainingMs <= 60_000
  const correctNow = reveal && isCorrect(q, selected)

  return (
    <div className="rise grid gap-6 lg:grid-cols-[minmax(0,1fr)_17rem]">
      <div className="min-w-0 space-y-4">
        {/* header */}
        <div className="card p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-sm font-bold">
                {t('quiz.questionOf', { current: session.index + 1, total })}
              </h1>
              <DomainBadge domain={q.domain} full />
              <span className="chip">{q.topic}</span>
              {session.label && <span className="chip border-info/40 bg-info-bg text-info">{session.label}</span>}
              <span className="chip">{t(isPractice ? 'mode.practice' : 'mode.exam')}</span>
            </div>
            <div className="flex items-center gap-2">
              {session.config.timerEnabled && remainingMs !== null && (
                <span
                  role="timer"
                  aria-label={t('quiz.timeLeft')}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold tabular-nums ${
                    lowTime ? 'bg-bad-bg text-bad' : 'bg-surface2'
                  }`}
                >
                  <Icon name="clock" className="size-4" />
                  {formatDuration(remainingMs)}
                </span>
              )}
              <button
                type="button"
                onClick={() => toggleFlag(q.id)}
                aria-pressed={!!session.flagged[q.id]}
                aria-keyshortcuts="F"
                className={`btn min-h-9 border px-3 text-xs ${
                  session.flagged[q.id] ? 'border-accent bg-accent/20' : 'border-line bg-surface hover:bg-surface2'
                }`}
              >
                <Icon name="flag" className="size-4" />
                {session.flagged[q.id] ? t('quiz.flagged') : t('quiz.flag')}
              </button>
            </div>
          </div>
          <div className="mt-3">
            <ProgressBar value={session.index + 1} max={total} label={t('quiz.progress')} />
          </div>
        </div>

        {studyCase && <CasePanel study={studyCase} />}

        {/* question */}
        <section className="card p-5 sm:p-7" aria-labelledby={`stem-${q.id}`}>
          <QuestionStem question={q} id={`stem-${q.id}`} />
          <div className="mt-5">
            <OptionList
              question={q}
              order={order}
              selected={selected}
              reveal={reveal}
              disabled={reveal}
              onToggle={toggleOption}
              labelledBy={`stem-${q.id}`}
            />
          </div>

          {reveal && (
            <div className="rise mt-6 space-y-4" role="status">
              <div
                className={`flex items-center gap-3 rounded-xl border-2 p-4 font-bold ${
                  correctNow ? 'border-ok-line bg-ok-bg text-ok' : 'border-bad-line bg-bad-bg text-bad'
                }`}
              >
                <Icon name={correctNow ? 'check' : 'x'} className="size-6" />
                <span>
                  {correctNow ? t('quiz.correct') : t('quiz.incorrect')}
                  {!correctNow && (
                    <span className="block text-sm font-medium text-ink">
                      {t('quiz.correctWas', {
                        answers: order
                          .map((k, i) => ({ k, letter: String.fromCharCode(65 + i) }))
                          .filter(({ k }) => q.correct.includes(k))
                          .map(({ letter }) => letter)
                          .join(', '),
                      })}
                    </span>
                  )}
                </span>
              </div>
              <ExplanationPanel question={q} />
            </div>
          )}
        </section>

        {/* controls */}
        <div className="flex items-center justify-between gap-3">
          <button type="button" className="btn-secondary" disabled={session.index === 0} onClick={() => goTo(session.index - 1)} aria-keyshortcuts="ArrowLeft">
            <Icon name="left" className="size-4" />
            {t('quiz.previous')}
          </button>
          <div className="flex items-center gap-2">
            {!isPractice && !isLast && (
              <button type="button" className="btn-ghost hidden sm:inline-flex" onClick={requestFinish}>
                {t('quiz.finishExam')}
              </button>
            )}
            <button
              type="button"
              className="btn-primary min-w-40"
              disabled={isPractice && !checked && selected.length === 0}
              onClick={primary}
              aria-keyshortcuts="Enter"
            >
              {primaryLabel}
              {!(isPractice && !checked) && !isLast && <Icon name="right" className="size-4" />}
            </button>
          </div>
        </div>

        <p className="hidden items-center gap-x-4 gap-y-1 text-xs text-muted lg:flex lg:flex-wrap" aria-label={t('quiz.shortcuts')}>
          <span>
            <span className="kbd">A</span>–<span className="kbd">E</span> {t('quiz.shortcut.select')}
          </span>
          <span>
            <span className="kbd">Enter</span> {isPractice ? t('quiz.shortcut.checkNext') : t('quiz.shortcut.next')}
          </span>
          <span>
            <span className="kbd">←</span> <span className="kbd">→</span> {t('quiz.shortcut.navigate')}
          </span>
          <span>
            <span className="kbd">F</span> {t('quiz.shortcut.flag')}
          </span>
        </p>
      </div>

      {/* overview */}
      <aside className="card h-fit space-y-4 p-4 lg:sticky lg:top-24" aria-labelledby="overview-title">
        <div className="flex items-center justify-between">
          <h2 id="overview-title" className="flex items-center gap-2 text-sm font-bold">
            <Icon name="grid" className="size-4" />
            {t('quiz.overview')}
          </h2>
          <span className="text-xs font-semibold text-muted tabular-nums">{t('quiz.answeredCount', { answered: answeredCount, total })}</span>
        </div>
        <QuestionNav ids={session.questionIds} current={session.index} stateOf={stateOf} isFlagged={(id) => !!session.flagged[id]} onGo={goTo} />
        <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-muted">
          <li className="flex items-center gap-1.5">
            <span className="size-3 rounded border border-line bg-surface" />
            {t('nav.unanswered')}
          </li>
          <li className="flex items-center gap-1.5">
            <span className="size-3 rounded border border-info bg-info-bg" />
            {t('nav.answered')}
          </li>
          {isPractice && (
            <>
              <li className="flex items-center gap-1.5">
                <span className="size-3 rounded border border-ok-line bg-ok-bg" />
                {t('nav.correct')}
              </li>
              <li className="flex items-center gap-1.5">
                <span className="size-3 rounded border border-bad-line bg-bad-bg" />
                {t('nav.wrong')}
              </li>
            </>
          )}
          <li className="flex items-center gap-1.5">
            <Icon name="flag" className="size-3 text-accent" />
            {t('nav.flagged')} ({flaggedCount})
          </li>
        </ul>
        <button type="button" className="btn-secondary w-full" onClick={requestFinish}>
          {isPractice ? t('quiz.endQuiz') : t('quiz.finishExam')}
        </button>
      </aside>

      <Dialog
        open={finishOpen}
        onClose={() => setFinishOpen(false)}
        title={isPractice ? t('finish.title.practice') : t('finish.title.exam')}
        actions={
          <>
            <button type="button" className="btn-secondary" onClick={() => setFinishOpen(false)}>
              {t('finish.keepGoing')}
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setFinishOpen(false)
                finish()
              }}
            >
              {t('finish.confirm')}
            </button>
          </>
        }
      >
        <p>{t('finish.summary', { answered: answeredCount, total })}</p>
        {unanswered.length > 0 && (
          <div className="mt-3">
            <p className="font-semibold text-ink">{tn('finish.unanswered', unanswered.length)}</p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {unanswered.map(({ i }) => (
                <li key={i}>
                  <button
                    type="button"
                    className="min-w-9 cursor-pointer rounded-lg border border-line bg-surface2 px-2 py-1 text-xs font-bold text-ink hover:border-accent"
                    onClick={() => {
                      setFinishOpen(false)
                      goTo(i)
                    }}
                  >
                    {i + 1}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {flaggedCount > 0 && <p className="mt-3">{tn('finish.flagged', flaggedCount)}</p>}
        {unanswered.length > 0 && <p className="mt-3 text-xs">{t('finish.note')}</p>}
      </Dialog>
    </div>
  )
}
