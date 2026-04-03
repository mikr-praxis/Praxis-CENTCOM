import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { MessageSquare } from 'lucide-react'

type LogEntry = {
  id: string
  workflow: string
  message: string
  platform: string
  time: string
}

export function MessageLog({ logs }: { logs: LogEntry[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Message Log</CardTitle>
      </CardHeader>
      <div className="space-y-4">
        {logs.length === 0 && (
          <p className="text-sm text-slate-500 text-center py-4">No messages yet</p>
        )}
        {logs.map((log) => (
          <div key={log.id} className="flex items-start gap-3 pb-3 border-b border-slate-700/30 last:border-0">
            <MessageSquare className="h-4 w-4 text-slate-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-300">{log.workflow}</span>
                <Badge variant="default">{log.platform}</Badge>
              </div>
              <p className="text-xs text-slate-400 mt-1">{log.message}</p>
              <span className="text-xs text-slate-600 mt-1 block">{log.time}</span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
