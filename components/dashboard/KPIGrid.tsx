import { MetricCard } from '@/components/ui/MetricCard'
import { DollarSign, CheckSquare, Calendar, Layers } from 'lucide-react'

type KPIGridProps = {
  burn: number
  activeTasks: number
  eventsThisWeek: number
  stackTools: number
  tasksTrend?: number
}

export function KPIGrid({ burn, activeTasks, eventsThisWeek, stackTools, tasksTrend }: KPIGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        title="Monthly Burn"
        value={`$${burn}`}
        subtitle="across all stack tools"
        icon={DollarSign}
        color="red"
      />
      <MetricCard
        title="Active Tasks"
        value={activeTasks}
        subtitle="todo + in progress + review"
        icon={CheckSquare}
        trend={tasksTrend !== undefined && tasksTrend !== 0 ? { value: tasksTrend, label: 'vs last week' } : undefined}
        color="blue"
      />
      <MetricCard
        title="Events This Week"
        value={eventsThisWeek}
        subtitle="internal + client"
        icon={Calendar}
        color="green"
      />
      <MetricCard
        title="Stack Tools"
        value={stackTools}
        subtitle="services in budget"
        icon={Layers}
        color="amber"
      />
    </div>
  )
}
