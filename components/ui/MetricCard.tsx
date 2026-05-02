import Link from 'next/link'
import { Card } from './Card'
import { clsx } from 'clsx'
import { ArrowRight, LucideIcon } from 'lucide-react'

type MetricCardProps = {
  title: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  trend?: { value: number; label: string }
  color?: 'amber' | 'green' | 'blue' | 'red'
  /** When the value is 0/empty/$0 and an empty-state CTA should replace the
   *  static subtitle. Renders as an inline link below the value. */
  emptyAction?: { label: string; href: string }
}

/** A value is "empty" if it's the literal number 0, the string '0', or
 *  '$0' / '$0.00' (the dashboard formats currency BEFORE handing it to us). */
function isEmpty(value: string | number): boolean {
  if (typeof value === 'number') return value === 0
  const trimmed = String(value).trim()
  if (trimmed === '0' || trimmed === '') return true
  return /^[$£€¥]\s*0(\.0+)?$/.test(trimmed)
}

export function MetricCard({ title, value, subtitle, icon: Icon, trend, color = 'amber', emptyAction }: MetricCardProps) {
  const colorMap = {
    amber: 'text-amber-400 bg-amber-500/10',
    green: 'text-emerald-400 bg-emerald-500/10',
    blue: 'text-blue-400 bg-blue-500/10',
    red: 'text-red-400 bg-red-500/10',
  }
  const showCta = emptyAction && isEmpty(value)

  return (
    <Card>
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-sm text-slate-400">{title}</p>
          <p className="mt-2 text-2xl md:text-3xl font-bold text-slate-100 break-words">{value}</p>
          {showCta ? (
            <Link
              href={emptyAction.href}
              className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-amber-400 hover:text-amber-300"
            >
              {emptyAction.label} <ArrowRight className="h-3 w-3" />
            </Link>
          ) : (
            subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
          )}
          {trend && (
            <p className={clsx('mt-2 text-xs font-medium', trend.value >= 0 ? 'text-emerald-400' : 'text-red-400')}>
              {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}% {trend.label}
            </p>
          )}
        </div>
        <div className={clsx('rounded-lg p-3 flex-shrink-0', colorMap[color])}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </Card>
  )
}
