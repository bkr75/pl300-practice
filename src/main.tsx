import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { KEYS, load, restoreFromMirror } from './lib/storage'

async function boot() {
  // Bring back data the browser may have dropped from localStorage (kept in the IndexedDB copy).
  // Never block startup for long if IndexedDB is slow or unavailable.
  await Promise.race([restoreFromMirror(), new Promise((resolve) => setTimeout(resolve, 1500))])
  const theme = load<string | null>(KEYS.theme, null)
  if (theme === 'light' || theme === 'dark') document.documentElement.setAttribute('data-theme', theme)

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void boot()
