import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import './index.css'
import { StoreProvider } from './state/store'
import { UiProvider } from './state/ui'

const container = document.getElementById('root')
if (!container) throw new Error('Root element not found')

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      <StoreProvider>
        <UiProvider>
          <App />
        </UiProvider>
      </StoreProvider>
    </ErrorBoundary>
  </StrictMode>,
)
