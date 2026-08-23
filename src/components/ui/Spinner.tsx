import { cx } from '../../lib/cx'

export function Spinner({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cx('h-4 w-4 animate-spin text-current', className)} aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" fill="none" opacity="0.22" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  )
}

export function EmptyState({
  icon,
  title,
  hint,
}: {
  icon: string
  title: string
  hint?: string
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 px-6 py-10 text-center">
      <span className="text-2xl opacity-70">{icon}</span>
      <p className="text-sm font-medium text-slate-600">{title}</p>
      {hint && <p className="max-w-[38ch] text-[12px] leading-relaxed text-slate-400">{hint}</p>}
    </div>
  )
}
