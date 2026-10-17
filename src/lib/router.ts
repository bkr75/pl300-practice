import { useSyncExternalStore } from 'react'

/** Minimal hash router so the static build works on any host without rewrites. */
export interface Route {
  path: string
  query: URLSearchParams
}

const listeners = new Set<() => void>()

function currentHash(): string {
  return typeof location === 'undefined' ? '' : location.hash
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  window.addEventListener('hashchange', cb)
  return () => {
    listeners.delete(cb)
    window.removeEventListener('hashchange', cb)
  }
}

export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#/, '') || '/'
  const [path, search = ''] = raw.split('?')
  return { path: path.startsWith('/') ? path : `/${path}`, query: new URLSearchParams(search) }
}

/** Synchronous so state updates made right after navigating commit together. */
export function navigate(to: string): void {
  if (currentHash() !== `#${to}`) location.hash = to
  listeners.forEach((l) => l())
  window.scrollTo?.({ top: 0 })
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, currentHash, () => '')
  return parseHash(hash)
}
