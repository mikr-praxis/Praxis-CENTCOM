'use client'

import { AgentCard } from '@/components/agents/AgentCard'
import { AGENTS } from '@/lib/anthropic/agents'
import { runAgent, approveAgent } from '@/actions/agents'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Shield } from 'lucide-react'

export function AgentsClient() {
  const handleRun = async (agentId: string) => {
    return await runAgent(agentId)
  }

  const handleApprove = async (agentId: string, agentName: string, output: string) => {
    await approveAgent(agentId, agentName, output)
  }

  return (
    <div className="space-y-6">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {AGENTS.map((agent) => (
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
}
