import { Card } from './Card'
import { clsx } from 'clsx'
import { LucideIcon } from 'lucide-react'

type MetricCardProps = {
  title: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  trend?: { value: number; label: string }
  color?: 'amber' | 'green' | 'blue' | 'red'
}

export function MetricCard({ title, value, subtitle, icon: Icon, trend, color = 'amber' }: MetricCardProps) {
  const colorMap = {
    amber: 'text-amber-400 bg-amber-500/10',
    green: 'text-emerald-400 bg-emerald-500/10',
    blue: 'text-blue-400 bg-blue-500/10',
    red: 'text-red-400 bg-red-500/10',
  }

  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-400">{title}</p>
          <p className="mt-2 text-3xl font-bold text-slate-100">{value}</p>
          {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
          {trend && (
            <p className={clsx('mt-2 text-xs font-medium', trend.value >= 0 ? 'text-emerald-400' : 'text-red-400')}>
              {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}% {trend.label}
            </p>
          )}
        </div>
        <div className={clsx('rounded-lg p-3', colorMap[color])}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </Card>
  )
}
