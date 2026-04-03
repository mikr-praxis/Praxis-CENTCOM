'use client'

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'

const data = [
  { week: 'Week 1', burn: 108, tasks: 12 },
  { week: 'Week 2', burn: 108, tasks: 15 },
  { week: 'Week 3', burn: 108, tasks: 10 },
  { week: 'Week 4', burn: 108, tasks: 18 },
]

export function TrendChart() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>4-Week Trend</CardTitle>
      </CardHeader>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id="burnGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="taskGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="week" stroke="#64748b" fontSize={12} />
            <YAxis stroke="#64748b" fontSize={12} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '8px',
                color: '#e2e8f0',
              }}
            />
            <Area type="monotone" dataKey="burn" stroke="#f59e0b" fill="url(#burnGradient)" strokeWidth={2} name="Burn ($)" />
            <Area type="monotone" dataKey="tasks" stroke="#3b82f6" fill="url(#taskGradient)" strokeWidth={2} name="Tasks" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
