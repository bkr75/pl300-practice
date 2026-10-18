import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState, type ReactNode } from 'react'
import { bank, questionsById } from '../data/bank'
import { navigate } from '../lib/router'
import { MAX_HISTORY, buildBackup, mergeBackup, type Backup } from '../lib/backup'
import { applyAttemptToStats, scoreSession } from '../lib/scoring'
import { createSession, pickQuestions } from '../lib/select'
import { KEYS, clearAll, load, remove, requestPersistence, save } from '../lib/storage'
import type { Attempt, Question, QuizConfig, Session, Stats } from '../types'

export type Theme = 'light' | 'dark'

type Action =
  | { type: 'start'; session: Session }
  | { type: 'answer'; id: string; keys: string[] }
  | { type: 'check'; id: string }
  | { type: 'flag'; id: string }
  | { type: 'goto'; index: number }
  | { type: 'tick'; ms: number }
  | { type: 'clear' }

function reducer(state: Session | null, action: Action): Session | null {
  if (action.type === 'start') return action.session
  if (action.type === 'clear') return null
  if (!state) return state
  switch (action.type) {
    case 'answer':
      // In practice mode an answer is locked once it has been checked.
      if (state.config.mode === 'practice' && state.checked[action.id]) return state
      return { ...state, answers: { ...state.answers, [action.id]: action.keys } }
    case 'check':
      return { ...state, checked: { ...state.checked, [action.id]: true } }
    case 'flag':
      return { ...state, flagged: { ...state.flagged, [action.id]: !state.flagged[action.id] } }
    case 'goto':
      return { ...state, index: Math.max(0, Math.min(action.index, state.questionIds.length - 1)) }
    case 'tick':
      return { ...state, elapsedMs: state.elapsedMs + action.ms }
  }
}

/** Drop a stored session that no longer matches the bundled question bank. */
function restoreSession(): Session | null {
  const s = load<Session | null>(KEYS.session, null)
  if (!s || !Array.isArray(s.questionIds) || s.questionIds.length === 0) return null
  if (!s.questionIds.every((id) => questionsById.has(id))) return null
  return { ...s, index: Math.max(0, Math.min(s.index ?? 0, s.questionIds.length - 1)) }
}

function systemTheme(): Theme {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

interface AppContextValue {
  session: Session | null
  history: Attempt[]
  stats: Stats
  theme: Theme
  lastAttempt: Attempt | null
  setupDefaults: QuizConfig | null
  toggleTheme: () => void
  /** Create a session from a config (random pick) or an explicit question list, then open it. */
  startQuiz: (config: QuizConfig, options?: { questions?: Question[]; label?: string }) => void
  answer: (id: string, keys: string[]) => void
  check: (id: string) => void
  toggleFlag: (id: string) => void
  goTo: (index: number) => void
  tick: (ms: number) => void
  finish: () => Attempt | null
  abandon: () => void
  rememberSetup: (config: QuizConfig) => void
  resetAll: () => void
  /** Result of the last backup export/import. Lives here so it survives the Progress page switching layout. */
  dataMessage: { ok: boolean; text: string } | null
  setDataMessage: (message: { ok: boolean; text: string } | null) => void
  exportBackup: () => Backup
  /** Merge a parsed backup into the current data; returns how many attempts were new. */
  importBackup: (backup: Backup) => number
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [session, dispatch] = useReducer(reducer, null, restoreSession)
  const [history, setHistory] = useState<Attempt[]>(() => load<Attempt[]>(KEYS.history, []))
  const [stats, setStats] = useState<Stats>(() => load<Stats>(KEYS.stats, {}))
  const [setupDefaults, setSetupDefaults] = useState<QuizConfig | null>(() => load<QuizConfig | null>(KEYS.setup, null))
  const [dataMessage, setDataMessage] = useState<AppContextValue['dataMessage']>(null)
  const [theme, setTheme] = useState<Theme>(() => (document.documentElement.getAttribute('data-theme') as Theme) || 'light')

  useEffect(() => {
    if (session) save(KEYS.session, session)
    else remove(KEYS.session)
  }, [session])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  // Follow the system theme until the user picks one explicitly.
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!mq) return
    const onChange = () => {
      if (load<Theme | null>(KEYS.theme, null) === null) setTheme(systemTheme())
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme((t) => {
      const next: Theme = t === 'dark' ? 'light' : 'dark'
      save(KEYS.theme, next)
      return next
    })
  }, [])

  const lastAttempt = history[0] ?? null

  const startQuiz = useCallback<AppContextValue['startQuiz']>(
    (config, options = {}) => {
      const questions = options.questions ?? pickQuestions(bank, config, { stats, lastAttempt })
      if (questions.length === 0) return
      void requestPersistence() // ask the browser not to evict our data (needs a user gesture on some browsers)
      dispatch({ type: 'start', session: createSession(questions, config, { label: options.label ?? null }) })
      navigate('/quiz')
    },
    [stats, lastAttempt],
  )

  const finish = useCallback(() => {
    if (!session) return null
    const attempt = scoreSession(session, questionsById, Date.now())
    setHistory((h) => {
      const next = [attempt, ...h.filter((a) => a.id !== attempt.id)].slice(0, MAX_HISTORY)
      save(KEYS.history, next)
      return next
    })
    setStats((s) => {
      const next = applyAttemptToStats(s, attempt.results, attempt.finishedAt)
      save(KEYS.stats, next)
      return next
    })
    dispatch({ type: 'clear' })
    navigate(`/results/${attempt.id}`)
    return attempt
  }, [session])

  const abandon = useCallback(() => {
    dispatch({ type: 'clear' })
    navigate('/')
  }, [])

  const rememberSetup = useCallback((config: QuizConfig) => {
    setSetupDefaults(config)
    save(KEYS.setup, config)
  }, [])

  const resetAll = useCallback(() => {
    clearAll()
    dispatch({ type: 'clear' })
    setHistory([])
    setStats({})
    setSetupDefaults(null)
    setDataMessage(null)
    const t = systemTheme()
    setTheme(t)
    navigate('/')
  }, [])

  // Stable callbacks so effects (like the quiz timer) are not re-created on every tick.
  const answer = useCallback((id: string, keys: string[]) => dispatch({ type: 'answer', id, keys }), [])
  const check = useCallback((id: string) => dispatch({ type: 'check', id }), [])
  const toggleFlag = useCallback((id: string) => dispatch({ type: 'flag', id }), [])
  const goTo = useCallback((index: number) => dispatch({ type: 'goto', index }), [])
  const tick = useCallback((ms: number) => dispatch({ type: 'tick', ms }), [])

  const exportBackup = useCallback(() => buildBackup(history, stats), [history, stats])

  const importBackup = useCallback(
    (backup: Backup) => {
      const merged = mergeBackup({ history, stats }, backup)
      setHistory(merged.history)
      setStats(merged.stats)
      save(KEYS.history, merged.history)
      save(KEYS.stats, merged.stats)
      return merged.addedAttempts
    },
    [history, stats],
  )

  const value = useMemo<AppContextValue>(
    () => ({
      session,
      history,
      stats,
      theme,
      lastAttempt,
      setupDefaults,
      toggleTheme,
      startQuiz,
      answer,
      check,
      toggleFlag,
      goTo,
      tick,
      finish,
      abandon,
      rememberSetup,
      resetAll,
      dataMessage,
      setDataMessage,
      exportBackup,
      importBackup,
    }),
    [session, history, stats, theme, lastAttempt, setupDefaults, toggleTheme, startQuiz, answer, check, toggleFlag, goTo, tick, finish, abandon, rememberSetup, resetAll, dataMessage, exportBackup, importBackup],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>')
  return ctx
}
