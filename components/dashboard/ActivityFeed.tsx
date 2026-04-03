import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { CheckCircle, Plus, ArrowRight, Bot } from 'lucide-react'

type Activity = {
  id: string
  action: string
  subject: string
  module: string
  time: string
}

export function ActivityFeed({ activities }: { activities: Activity[] }) {
  const iconMap: Record<string, React.ReactNode> = {
    completed: <CheckCircle className="h-4 w-4 text-emerald-400" />,
    created: <Plus className="h-4 w-4 text-blue-400" />,
    moved: <ArrowRight className="h-4 w-4 text-amber-400" />,
    ran: <Bot className="h-4 w-4 text-purple-400" />,
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <div className="space-y-4">
        {activities.length === 0 && (
          <p className="text-sm text-slate-500">No recent activity</p>
        )}
        {activities.map((activity) => (
          <div key={activity.id} className="flex items-start gap-3">
            <div className="mt-0.5">{iconMap[activity.action] || iconMap.created}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-300">
                <span className="capitalize">{activity.action}</span>{' '}
                <span className="font-medium text-slate-100">{activity.subject}</span>
              </p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="default">{activity.module}</Badge>
                <span className="text-xs text-slate-500">{activity.time}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
