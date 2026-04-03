import { clsx } from 'clsx'

type BadgeProps = {
  children: React.ReactNode
  variant?: 'default' | 'amber' | 'green' | 'red' | 'blue' | 'gray' | 'orange'
  className?: string
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        {
          'bg-slate-700 text-slate-300': variant === 'default',
          'bg-amber-500/20 text-amber-400': variant === 'amber',
          'bg-emerald-500/20 text-emerald-400': variant === 'green',
          'bg-red-500/20 text-red-400': variant === 'red',
          'bg-blue-500/20 text-blue-400': variant === 'blue',
          'bg-slate-600/50 text-slate-400': variant === 'gray',
          'bg-orange-500/20 text-orange-400': variant === 'orange',
        },
        className
      )}
    >
      {children}
    </span>
  )
}
