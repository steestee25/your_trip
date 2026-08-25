import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

const STORAGE_KEY = 'utp.state.v1'

/**
 * Last line of defence. Without this, any render-time crash leaves a blank
 * white page with no explanation and no way for the user to rescue their trip.
 * The fallback always offers a way to get the data out before resetting.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Universal Trip Planner crashed:', error, info.componentStack)
  }

  private downloadBackup = (): void => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) {
        window.alert('No saved trip was found in this browser.')
        return
      }
      const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }))
      const link = document.createElement('a')
      link.href = url
      link.download = 'trip-planner-backup.json'
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch {
      window.alert('Could not read the saved trip from this browser.')
    }
  }

  private reset = (): void => {
    if (!window.confirm('Delete the locally saved trip and start fresh? Download the backup first if you need it.')) {
      return
    }
    try {
      localStorage.removeItem(STORAGE_KEY)
      indexedDB.deleteDatabase('universal-trip-planner')
    } catch {
      /* nothing else we can do */
    }
    window.location.reload()
  }

  render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="grid min-h-full place-items-center bg-slate-100 p-6">
        <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-panel">
          <h1 className="text-lg font-bold text-slate-900">Something went wrong</h1>
          <p className="mt-1 text-[13px] leading-relaxed text-slate-600">
            The app hit an unexpected error and stopped. Your saved trip is still in this browser — download a
            backup before doing anything else.
          </p>

          <pre className="scroll-thin mt-3 max-h-32 overflow-auto rounded-lg bg-slate-900 p-3 text-[11px] leading-relaxed text-slate-100">
            {error.message || String(error)}
          </pre>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-lg bg-brand-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-800"
            >
              Reload the app
            </button>
            <button
              type="button"
              onClick={this.downloadBackup}
              className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Download backup
            </button>
            <button
              type="button"
              onClick={this.reset}
              className="rounded-lg border border-rose-200 bg-white px-3.5 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50"
            >
              Reset local data
            </button>
          </div>
        </div>
      </div>
    )
  }
}
