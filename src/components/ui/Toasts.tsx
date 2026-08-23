import { cx } from '../../lib/cx'
import { useUi } from '../../state/ui'

const TONES: Record<string, string> = {
  info: 'bg-slate-900 text-white',
  success: 'bg-emerald-600 text-white',
  warning: 'bg-amber-500 text-white',
  error: 'bg-rose-600 text-white',
}

export function Toasts() {
  const { toasts, dismissToast } = useUi()
  if (toasts.length === 0) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-1100 flex flex-col items-center gap-2 px-4 sm:bottom-6">
      {toasts.map((toast) => (
        <button
          key={toast.id}
          type="button"
          onClick={() => dismissToast(toast.id)}
          className={cx(
            'pointer-events-auto max-w-[92vw] rounded-xl px-4 py-2.5 text-left text-[13px] font-medium shadow-lg animate-rise sm:max-w-md',
            TONES[toast.tone],
          )}
        >
          {toast.message}
        </button>
      ))}
    </div>
  )
}
