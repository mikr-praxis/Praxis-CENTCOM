'use client'

import { AgentCard } from '@/components/agents/AgentCard'
import { AGENTS } from '@/lib/anthropic/agents'
import { runAgent, approveAgent } from '@/actions/agents'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Shield, Cpu, ClipboardCheck, BarChart3 } from 'lucide-react'

const CATEGORIES = [
  { key: 'ops', label: 'Operations', icon: BarChart3, color: 'text-amber-400' },
  { key: 'intel', label: 'Intelligence', icon: Cpu, color: 'text-purple-400' },
  { key: 'audit', label: 'Audits', icon: ClipboardCheck, color: 'text-cyan-400' },
] as const

export function AgentsClient() {
  const handleRun = async (agentId: string) => {
    return await runAgent(agentId)
  }

  const handleApprove = async (agentId: string, agentName: string, output: string) => {
    await approveAgent(agentId, agentName, output)
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">AI Agents</h1>
          <p className="text-sm text-slate-400 mt-1">
            Run AI-powered analysis on your live ops data
          </p>
        </div>
        <Badge variant="amber">
          <Shield className="h-3 w-3 mr-1" />
          Human-in-the-loop
        </Badge>
      </div>

      <Card className="bg-amber-500/5 border-amber-500/20">
        <div className="flex items-start gap-3">
          <Shield className="h-5 w-5 text-amber-400 mt-0.5" />
          <div>
            <p className="text-sm text-slate-200 font-medium">All outputs require human verification</p>
            <p className="text-xs text-slate-400 mt-1">
              Agent outputs are generated from your live Supabase data. Review each output carefully before approving.
              Approved outputs are logged for audit. Rate limited to 10 runs per hour.
            </p>
          </div>
        </div>
      </Card>

      {CATEGORIES.map((cat) => {
        const catAgents = AGENTS.filter((a) => a.category === cat.key)
        if (catAgents.length === 0) return null
        const Icon = cat.icon

        return (
          <div key={cat.key}>
            <div className="flex items-center gap-2 mb-4">
              <Icon className={`h-4 w-4 ${cat.color}`} />
              <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
                {cat.label}
              </h2>
              <span className="text-[10px] text-slate-500">({catAgents.length})</span>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {catAgents.map((agent) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  onRun={handleRun}
                  onApprove={handleApprove}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
