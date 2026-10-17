import { formatDate, formatPercent, shortDomain } from '../lib/format'
import { PASS_PERCENT } from '../lib/scoring'
import { t } from '../i18n'
import type { Attempt } from '../types'
import { domainColor } from './domainColors'
import { DomainBadge } from './ui'

export function ScoreRing({ percent, passed, size = 148 }: { percent: number; passed: boolean; size?: number }) {
  const stroke = 12
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const color = passed ? 'var(--ok)' : 'var(--bad)'
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }} role="img" aria-label={t('results.scoreAria', { percent: Math.round(percent) })}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.min(100, percent) / 100)}
          style={{ transition: 'stroke-dashoffset 600ms ease-out' }}
        />
      </svg>
      <div className="absolute text-center">
        <div className="text-3xl font-extrabold tabular-nums">{formatPercent(percent)}</div>
      </div>
    </div>
  )
}

export interface BarRow {
  domain: string
  correct: number
  total: number
}

/** Horizontal bars per domain with a marker on the 70% pass line. */
export function DomainBars({ rows }: { rows: BarRow[] }) {
  return (
    <ul className="space-y-4">
      {rows.map((row) => {
        const pct = row.total === 0 ? 0 : (row.correct / row.total) * 100
        return (
          <li key={row.domain}>
            <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <DomainBadge domain={row.domain} />
                <span className="truncate text-muted">{row.domain}</span>
              </span>
              <span className="shrink-0 font-semibold tabular-nums">
                {row.total === 0 ? t('chart.noData') : `${row.correct}/${row.total} · ${formatPercent(pct)}`}
              </span>
            </div>
            <div
              className="relative h-3 overflow-hidden rounded-full bg-surface2"
              role="progressbar"
              aria-label={row.domain}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(pct)}
            >
              <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, background: domainColor(row.domain) }} />
              <div className="absolute inset-y-0 w-0.5 bg-ink/40" style={{ left: `${PASS_PERCENT}%` }} title={t('chart.passLine', { percent: PASS_PERCENT })} />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/** Score-over-time line chart (oldest to newest) with the pass line. */
export function ScoreLine({ attempts }: { attempts: Attempt[] }) {
  const data = [...attempts].reverse()
  const W = 640
  const H = 220
  const pad = { l: 36, r: 16, t: 14, b: 28 }
  const iw = W - pad.l - pad.r
  const ih = H - pad.t - pad.b
  const x = (i: number) => pad.l + (data.length <= 1 ? iw / 2 : (i / (data.length - 1)) * iw)
  const y = (p: number) => pad.t + ih - (p / 100) * ih
  const line = data.map((a, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(a.percent).toFixed(1)}`).join(' ')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={t('chart.scoreOverTimeAria')}>
      {[0, 25, 50, 75, 100].map((g) => (
        <g key={g}>
          <line x1={pad.l} x2={W - pad.r} y1={y(g)} y2={y(g)} stroke="var(--border)" strokeWidth="1" />
          <text x={pad.l - 8} y={y(g) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">
            {g}
          </text>
        </g>
      ))}
      <line x1={pad.l} x2={W - pad.r} y1={y(PASS_PERCENT)} y2={y(PASS_PERCENT)} stroke="var(--ok)" strokeWidth="1.5" strokeDasharray="5 4" />
      <text x={W - pad.r} y={y(PASS_PERCENT) - 5} textAnchor="end" fontSize="11" fontWeight="600" fill="var(--ok)">
        {t('chart.passLine', { percent: PASS_PERCENT })}
      </text>
      {data.length > 1 && <path d={line} fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />}
      {data.map((a, i) => (
        <g key={a.id}>
          <circle cx={x(i)} cy={y(a.percent)} r="5.5" fill="var(--accent)" stroke="var(--surface)" strokeWidth="2.5">
            <title>{`${formatDate(a.finishedAt)} · ${formatPercent(a.percent)} (${a.correct}/${a.total})`}</title>
          </circle>
          {(data.length <= 8 || i === 0 || i === data.length - 1) && (
            <text
              x={x(i)}
              y={H - 8}
              textAnchor={data.length > 1 && i === 0 ? 'start' : data.length > 1 && i === data.length - 1 ? 'end' : 'middle'}
              fontSize="10.5"
              fill="var(--muted)"
            >
              {formatDate(a.finishedAt)}
            </text>
          )}
        </g>
      ))}
    </svg>
  )
}

export function DistributionPreview({ counts, domains }: { counts: Record<string, number>; domains: string[] }) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-surface2" aria-hidden="true">
        {domains.map((d) =>
          counts[d] > 0 ? (
            <div key={d} className="h-full transition-[width] duration-300" style={{ width: `${(counts[d] / total) * 100}%`, background: domainColor(d) }} />
          ) : null,
        )}
      </div>
      <ul className="mt-3 flex flex-wrap gap-2">
        {domains.map((d) => (
          <li key={d} className="chip" style={{ opacity: counts[d] > 0 ? 1 : 0.5 }}>
            <span className="size-2 rounded-full" style={{ background: domainColor(d) }} />
            {shortDomain(d)} <strong className="tabular-nums">{counts[d] ?? 0}</strong>
          </li>
        ))}
      </ul>
    </div>
  )
}
