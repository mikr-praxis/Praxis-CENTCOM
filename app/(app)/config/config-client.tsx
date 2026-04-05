'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import {
  Settings,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ExternalLink,
  Database,
  Shield,
  Bot,
  Calendar,
  LayoutGrid,
  MessageSquare,
  Gauge,
  BarChart3,
  Rocket,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
} from 'lucide-react'

type VarStatus = {
  key: string
  label: string
  hint: string
  configured: boolean
}

type ModuleConfig = {
  id: string
  name: string
  description: string
  docsUrl: string
  vars: VarStatus[]
  status: 'ready' | 'partial' | 'missing'
}

const iconMap: Record<string, React.ElementType> = {
  supabase: Database,
  clerk: Shield,
  anthropic: Bot,
  'google-calendar': Calendar,
  monday: LayoutGrid,
  slack: MessageSquare,
  upstash: Gauge,
  posthog: BarChart3,
  vercel: Rocket,
}

const statusConfig = {
  ready: { label: 'Live', variant: 'green' as const, icon: CheckCircle2 },
  partial: { label: 'Partial', variant: 'amber' as const, icon: AlertTriangle },
  missing: { label: 'Not Configured', variant: 'red' as const, icon: XCircle },
}

export function ConfigClient() {
  const [modules, setModules] = useState<ModuleConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/config')
      .then((res) => res.json())
      .then((data) => {
        setModules(data.modules || [])
        // Auto-expand modules that need attention
        const needsAttention = new Set<string>()
        for (const mod of data.modules || []) {
          if (mod.status !== 'ready') needsAttention.add(mod.id)
        }
        setExpanded(needsAttention)
      })
      .finally(() => setLoading(false))
  }, [])

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const copyEnvTemplate = (mod: ModuleConfig) => {
    const template = mod.vars.map((v) => `${v.key}=`).join('\n')
    navigator.clipboard.writeText(template)
    setCopiedKey(mod.id)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  const readyCount = modules.filter((m) => m.status === 'ready').length
  const totalCount = modules.length

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-slate-700/30 rounded animate-pulse w-48" />
        <div className="grid gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-24 bg-slate-800/50 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Configuration</h1>
          <p className="text-sm text-slate-400 mt-1">
            Module status and environment setup
          </p>
        </div>
        <Badge variant={readyCount === totalCount ? 'green' : 'amber'}>
          <Settings className="h-3 w-3 mr-1" />
          {readyCount}/{totalCount} modules live
        </Badge>
      </div>

      {/* Summary bar */}
      <Card className="bg-slate-800/30">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span className="text-sm text-slate-300">
              {modules.filter((m) => m.status === 'ready').length} live
            </span>
          </div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <span className="text-sm text-slate-300">
              {modules.filter((m) => m.status === 'partial').length} partial
            </span>
          </div>
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-red-400" />
            <span className="text-sm text-slate-300">
              {modules.filter((m) => m.status === 'missing').length} missing
            </span>
          </div>
        </div>
      </Card>

      {/* Module cards */}
      <div className="space-y-3">
        {modules.map((mod) => {
          const Icon = iconMap[mod.id] || Settings
          const status = statusConfig[mod.status]
          const StatusIcon = status.icon
          const isExpanded = expanded.has(mod.id)

          return (
            <Card key={mod.id} className="p-0 overflow-hidden">
              {/* Module header — always visible */}
              <button
                onClick={() => toggleExpand(mod.id)}
                className="w-full flex items-center gap-4 p-5 text-left hover:bg-slate-700/20 transition-colors"
              >
                <div className="rounded-lg bg-slate-700/40 p-2.5">
                  <Icon className="h-5 w-5 text-slate-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-200">{mod.name}</h3>
                    <Badge variant={status.variant}>
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {status.label}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5 truncate">{mod.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">
                    {mod.vars.filter((v) => v.configured).length}/{mod.vars.length} vars
                  </span>
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-slate-500" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-slate-500" />
                  )}
                </div>
              </button>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="border-t border-slate-700/50 bg-slate-900/30 px-5 py-4">
                  <div className="space-y-3">
                    {mod.vars.map((v) => (
                      <div key={v.key} className="flex items-start gap-3">
                        {v.configured ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <code className="text-xs text-slate-200 font-mono bg-slate-700/50 px-1.5 py-0.5 rounded">
                              {v.key}
                            </code>
                            {v.configured && (
                              <span className="text-[10px] text-emerald-400">set</span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {v.label} — {v.hint}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="mt-4 pt-3 border-t border-slate-700/30 flex items-center gap-3">
                    <a
                      href={mod.docsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 transition-colors"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Open docs
                    </a>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        copyEnvTemplate(mod)
                      }}
                      className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
                    >
                      {copiedKey === mod.id ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-400" />
                          <span className="text-emerald-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          Copy .env template
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </Card>
          )
        })}
      </div>

      {/* Help note */}
      <Card className="bg-amber-500/5 border-amber-500/20">
        <div className="flex items-start gap-3">
          <Settings className="h-5 w-5 text-amber-400 mt-0.5" />
          <div>
            <p className="text-sm text-slate-200 font-medium">Adding environment variables</p>
            <p className="text-xs text-slate-400 mt-1">
              Set variables in your Vercel project settings under Settings → Environment Variables.
              For local development, add them to <code className="bg-slate-700/50 px-1 py-0.5 rounded text-slate-300">.env.local</code> in the project root.
              After updating variables on Vercel, trigger a redeploy for changes to take effect.
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
