'use client'

import { Button } from '@/components/ui/Button'
import { Check, RefreshCw, X } from 'lucide-react'

type AgentOutputProps = {
  output: string
  approved: boolean
  onApprove: () => void
  onRegenerate: () => void
  onDismiss: () => void
}

export function AgentOutput({ output, approved, onApprove, onRegenerate, onDismiss }: AgentOutputProps) {
  return (
    <div className="mt-4">
      <div className="max-h-64 overflow-y-auto rounded-lg bg-slate-900/50 border border-slate-700/50 p-4">
        <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">
          {output}
        </pre>
      </div>
      {!approved ? (
        <div className="flex items-center gap-2 mt-3">
          <Button onClick={onApprove} size="sm">
            <Check className="h-3.5 w-3.5 mr-1" />
            Approve
          </Button>
          <Button onClick={onRegenerate} variant="secondary" size="sm">
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            Regenerate
          </Button>
          <Button onClick={onDismiss} variant="ghost" size="sm">
            <X className="h-3.5 w-3.5 mr-1" />
            Dismiss
          </Button>
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-2 text-emerald-400">
          <Check className="h-4 w-4" />
          <span className="text-xs font-medium">Approved and logged</span>
        </div>
      )}
    </div>
  )
}
