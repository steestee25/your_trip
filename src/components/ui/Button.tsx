import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cx } from '../../lib/cx'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle'
type Size = 'sm' | 'md' | 'icon'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand-700 text-white hover:bg-brand-800 active:bg-brand-900 border-transparent shadow-sm',
  secondary: 'bg-white text-slate-700 hover:bg-slate-50 border-slate-300 shadow-sm',
  ghost: 'bg-transparent text-slate-600 hover:bg-slate-100 border-transparent',
  danger: 'bg-white text-rose-600 hover:bg-rose-50 border-rose-200',
  subtle: 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-transparent',
}

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-2.5 text-[13px] gap-1.5',
  md: 'h-9.5 px-3.5 text-sm gap-2',
  icon: 'h-8 w-8 justify-center',
}

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: ReactNode
}

export function Button({ variant = 'secondary', size = 'md', icon, className, children, ...rest }: Props) {
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        'inline-flex items-center rounded-lg border font-medium transition-colors focus-ring',
        'disabled:cursor-not-allowed disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
    >
      {icon}
      {children}
    </button>
  )
}
