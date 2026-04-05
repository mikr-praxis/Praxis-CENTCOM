'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { AgentOutput } from './AgentOutput'
import {
  Play, Loader2, FileText, DollarSign, ListOrdered, Mail,
  Cpu, Wind, UserCheck, HeartPulse, TrendingUp,
} from 'lucide-react'

const iconMap: Record<string, React.ElementType> = {
  FileText,
  DollarSign,
  ListOrdered,
  Mail,
  Cpu,
  Wind,
  UserCheck,
  HeartPulse,
  TrendingUp,
}

type AgentCardProps = {
  agent: {
    id: string
    name: string
    description: string
    icon: string
  }
  onRun: (agentId: string) => Promise<string>
  onApprove: (agentId: string, agentName: string, output: string) => Promise<void>
}

export function AgentCard({ agent, onRun, onApprove }: AgentCardProps) {
  const [output, setOutput] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [approved, setApproved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const Icon = iconMap[agent.icon] || FileText

  const handleRun = async () => {
    setLoading(true)
    setOutput(null)
    setError(null)
    setApproved(false)
    try {
      const result = await onRun(agent.id)
      setOutput(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Agent run failed')
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async () => {
    if (!output) return
    await onApprove(agent.id, agent.name, output)
    setApproved(true)
  }

  const handleRegenerate = () => {
    handleRun()
  }

  const handleDismiss = () => {
    setOutput(null)
    setError(null)
    setApproved(false)
  }

  return (
    <Card>
      <div className="flex items-start gap-4">
        <div className="rounded-lg bg-amber-500/10 p-3">
          <Icon className="h-6 w-6 text-amber-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-slate-200">{agent.name}</h3>
          <p className="text-xs text-slate-400 mt-1">{agent.description}</p>
        </div>
        <Button
          onClick={handleRun}
          disabled={loading}
          size="sm"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1" />
          ) : (
            <Play className="h-4 w-4 mr-1" />
          )}
          {loading ? 'Running...' : 'Run'}
        </Button>
      </div>

      {error && (
        <div className="mt-4 rounded-lg bg-red-500/10 border border-red-500/20 p-3">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {output && (
        <AgentOutput
          output={output}
          approved={approved}
          onApprove={handleApprove}
          onRegenerate={handleRegenerate}
          onDismiss={handleDismiss}
        />
      )}
    </Card>
  )
}
