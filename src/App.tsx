import { Layout } from './components/Layout'
import { useRoute } from './lib/router'
import { History } from './screens/History'
import { Home } from './screens/Home'
import { Quiz } from './screens/Quiz'
import { Results } from './screens/Results'
import { Setup } from './screens/Setup'
import { AppProvider } from './state/AppState'

function Screen() {
  const { path } = useRoute()
  if (path === '/setup') return <Setup />
  if (path === '/quiz') return <Quiz />
  if (path.startsWith('/results/')) return <Results />
  if (path === '/history') return <History />
  return <Home />
}

export default function App() {
  return (
    <AppProvider>
      <Layout>
        <Screen />
      </Layout>
    </AppProvider>
  )
}
