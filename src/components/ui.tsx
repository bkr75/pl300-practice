import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { shortDomain } from '../lib/format'
import { t } from '../i18n'
import { domainColors } from './domainColors'

/* ---------- icons ---------- */

const ICONS = {
  check: 'M20 6 9 17l-5-5',
  x: 'M18 6 6 18M6 6l12 12',
  flag: 'M4 22V4M4 4h13l-2 4 2 4H4',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 7v5l3 2',
  copy: 'M9 9h11v11H9ZM5 15H4V4h11v1',
  left: 'm15 18-6-6 6-6',
  right: 'm9 18 6-6-6-6',
  down: 'm6 9 6 6 6-6',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z',
  grid: 'M3 3h7v7H3ZM14 3h7v7h-7ZM3 14h7v7H3ZM14 14h7v7h-7Z',
  play: 'm6 4 14 8-14 8Z',
  history: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2',
  home: 'm3 11 9-8 9 8M5 10v10h14V10',
  refresh: 'M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5',
  download: 'M12 3v12M7 10l5 5 5-5M4 21h16',
  print: 'M6 9V3h12v6M6 18H4v-7h16v7h-2M7 14h10v7H7Z',
  target: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  alert: 'M12 3 2 20h20ZM12 10v4M12 17.5v.5',
  bolt: 'M13 2 4 14h7l-1 8 9-12h-7Z',
  book: 'M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4ZM20 4h-6a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h7Z',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 11v5M12 8v.01',
} as const

export type IconName = keyof typeof ICONS

export function Icon({ name, className = 'size-5' }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={ICONS[name]} />
    </svg>
  )
}

/* ---------- domain badge ---------- */

export function DomainBadge({ domain, full = false }: { domain: string; full?: boolean }) {
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold" style={domainColors(domain)}>
      {full ? domain : shortDomain(domain)}
    </span>
  )
}

/* ---------- progress ---------- */

export function ProgressBar({ value, max = 100, label, color }: { value: number; max?: number; label: string; color?: string }) {
  const pct = max === 0 ? 0 : Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.round(value)}
      className="h-2 w-full overflow-hidden rounded-full bg-surface2"
    >
      <div
        className="h-full rounded-full bg-accent transition-[width] duration-300"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  )
}

/* ---------- switch ---------- */

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  description?: string
  disabled?: boolean
}) {
  const id = useId()
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div>
        <label htmlFor={id} className="text-sm font-semibold">
          {label}
        </label>
        {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 cursor-pointer rounded-full border transition disabled:cursor-not-allowed disabled:opacity-50 ${
          checked ? 'border-accent bg-accent' : 'border-line bg-surface2'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 size-4.5 rounded-full shadow transition-transform ${
            checked ? 'translate-x-5 bg-accent-ink' : 'bg-muted'
          }`}
        />
      </button>
    </div>
  )
}

/* ---------- modal dialog (native <dialog>: focus trap + Esc for free) ---------- */

export function Dialog({
  open,
  onClose,
  title,
  children,
  actions,
}: {
  open: boolean
  onClose: () => void
  title: string
  children?: ReactNode
  actions: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) el.showModal()
    if (!open && el.open) el.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-0 text-ink shadow-soft"
    >
      {open && (
        <div className="p-6">
          <h2 id={titleId} className="text-lg font-bold">
            {title}
          </h2>
          <div className="mt-3 text-sm text-muted">{children}</div>
          <div className="mt-6 flex flex-wrap justify-end gap-2">{actions}</div>
        </div>
      )}
    </dialog>
  )
}

/* ---------- code block with copy button ---------- */

export function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(code)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = code
      document.body.appendChild(ta)
      ta.select()
      try {
        document.execCommand('copy')
      } finally {
        ta.remove()
      }
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="overflow-hidden rounded-xl border border-line" style={{ background: 'var(--code-bg)' }}>
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-1.5">
        <span className="font-mono text-[11px] tracking-wide text-white/50 uppercase">{t('code.label')}</span>
        <button
          type="button"
          onClick={copy}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold text-white/80 hover:bg-white/10"
        >
          <Icon name={copied ? 'check' : 'copy'} className="size-3.5" />
          <span aria-live="polite">{copied ? t('code.copied') : t('code.copy')}</span>
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-sm leading-relaxed" style={{ color: 'var(--code-text)' }}>
        <code className="font-mono">{code}</code>
      </pre>
    </div>
  )
}
