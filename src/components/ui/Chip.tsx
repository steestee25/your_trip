import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'

interface Props {
  active?: boolean
  onClick?: () => void
  color?: string
  children: ReactNode
  title?: string
  count?: number
}

export function Chip({ active, onClick, color, children, title, count }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium transition-all focus-ring',
        active
          ? 'border-brand-600 bg-brand-50 text-brand-900 shadow-[inset_0_0_0_1px] shadow-brand-600/30'
          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50',
      )}
    >
      {color && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />}
      <span className="truncate">{children}</span>
      {count !== undefined && (
        <span className={cx('tabular-nums', active ? 'text-brand-700' : 'text-slate-400')}>{count}</span>
      )}
    </button>
  )
}

export function Badge({
  children,
  tone = 'slate',
  className,
}: {
  children: ReactNode
  tone?: 'slate' | 'brand' | 'amber' | 'rose' | 'emerald' | 'sky'
  className?: string
}) {
  const tones: Record<string, string> = {
    slate: 'bg-slate-100 text-slate-600',
    brand: 'bg-brand-50 text-brand-800',
    amber: 'bg-amber-50 text-amber-700',
    rose: 'bg-rose-50 text-rose-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    sky: 'bg-sky-50 text-sky-700',
  }
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
