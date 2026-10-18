import { useState, type ReactNode } from 'react'
import { t } from '../i18n'
import { useRoute } from '../lib/router'
import { isInAppBrowser, storageAvailable } from '../lib/storage'
import { useApp } from '../state/AppState'
import { Icon } from './ui'

function NavLink({ to, icon, children, active }: { to: string; icon: 'home' | 'play' | 'history'; children: ReactNode; active: boolean }) {
  return (
    <a
      href={`#${to}`}
      aria-current={active ? 'page' : undefined}
      className={`inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition ${
        active ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
      }`}
    >
      <Icon name={icon} className="size-4" />
      <span className="hidden sm:inline">{children}</span>
    </a>
  )
}

/** Warns when progress cannot be saved here (private mode) or may be wiped (in-app browsers). */
function StorageBanner() {
  const [problem] = useState<'blocked' | 'inapp' | null>(() => (!storageAvailable() ? 'blocked' : isInAppBrowser() ? 'inapp' : null))
  if (!problem) return null
  return (
    <div role="alert" className={`print:hidden ${problem === 'blocked' ? 'bg-bad-bg text-bad' : 'bg-warn-bg text-warn'}`}>
      <p className="mx-auto flex max-w-6xl items-start gap-2 px-4 py-3 text-sm font-semibold">
        <Icon name="alert" className="mt-0.5 size-4 shrink-0" />
        {problem === 'blocked' ? t('banner.blocked') : t('banner.inApp')}
      </p>
    </div>
  )
}

export function Layout({ children }: { children: ReactNode }) {
  const { theme, toggleTheme, session } = useApp()
  const { path } = useRoute()
  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        onClick={(e) => {
          e.preventDefault()
          document.getElementById('main')?.focus()
        }}
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:font-semibold focus:text-accent-ink"
      >
        {t('app.skip')}
      </a>
      <header className="sticky top-0 z-30 border-b border-white/10 bg-navy text-white print:hidden">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
          <a href="#/" className="flex items-center gap-2.5 rounded-lg font-extrabold tracking-tight">
            <span className="grid size-9 place-items-center rounded-xl bg-accent text-accent-ink">
              <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden="true">
                <rect x="3" y="12" width="4.5" height="9" rx="1.2" opacity=".55" />
                <rect x="9.75" y="7.5" width="4.5" height="13.5" rx="1.2" opacity=".8" />
                <rect x="16.5" y="3" width="4.5" height="18" rx="1.2" />
              </svg>
            </span>
            <span className="text-[17px] whitespace-nowrap">
              {t('app.name')} <span className="hidden text-accent min-[430px]:inline">{t('app.exam')}</span>
            </span>
          </a>
          <nav aria-label={t('app.nav')} className="flex items-center gap-1">
            <NavLink to="/" icon="home" active={path === '/'}>
              {t('nav.home')}
            </NavLink>
            {session && (
              <NavLink to="/quiz" icon="play" active={path === '/quiz'}>
                {t('nav.resume')}
              </NavLink>
            )}
            <NavLink to="/setup" icon="play" active={path === '/setup'}>
              {t('nav.newQuiz')}
            </NavLink>
            <NavLink to="/history" icon="history" active={path === '/history'}>
              {t('nav.progress')}
            </NavLink>
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? t('theme.toLight') : t('theme.toDark')}
              className="ml-1 grid size-10 cursor-pointer place-items-center rounded-lg text-white/80 transition hover:bg-white/10 hover:text-white"
            >
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
            </button>
          </nav>
        </div>
      </header>
      <StorageBanner />
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 outline-none sm:py-8">
        {children}
      </main>
      <footer className="border-t border-line py-6 text-center text-xs text-muted print:hidden">{t('app.footer')}</footer>
    </div>
  )
}
