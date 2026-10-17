import type { CSSProperties } from 'react'
import { bank } from '../data/bank'

/** Each domain gets one of four palette slots (--d0..--d3, defined per theme in index.css). */
function slot(domain: string): number {
  return Math.max(0, bank.domains.indexOf(domain)) % 4
}

export function domainColors(domain: string): CSSProperties {
  return { color: `var(--d${slot(domain)})`, background: `var(--d${slot(domain)}-bg)` }
}

export function domainColor(domain: string): string {
  return `var(--d${slot(domain)})`
}
