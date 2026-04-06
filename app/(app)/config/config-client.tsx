'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
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
  Target,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Save,
  Pencil,
  X,
  Loader2,
  RotateCcw,
  Lock,
} from 'lucide-react'

type VarStatus = {
  key: string
  label: string
  hint: string
  configured: boolean
  maskedValue: string
  source: 'env' | 'database' | 'none'
}

type ModuleConfig = {
  id: string
  name: string
  description: string
  docsUrl: string
  editable: boolean
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
  hubspot: Target,
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

  // Edit state: module ID -> { key -> value }
  const [editing, setEditing] = useState<Record<string, Record<string, string>>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [saveResults, setSaveResults] = useState<Record<string, { ok: boolean; error?: string }>>({})

  const fetchModules = useCallback(async () => {
    const res = await fetch('/api/config')
    const data = await res.json()
    setModules(data.modules || [])
    return data.modules || []
  }, [])

  useEffect(() => {
    fetchModules()
      .then((mods: ModuleConfig[]) => {
        // Auto-expand modules that need attention
        const needsAttention = new Set<string>()
        for (const mod of mods) {
          if (mod.status !== 'ready') needsAttention.add(mod.id)
        }
        setExpanded(needsAttention)
      })
      .finally(() => setLoading(false))
  }, [fetchModules])

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

  // ── Edit handlers ─────────────────────────────────────────────────────

  const startEditing = (modId: string, vars: VarStatus[]) => {
    // Pre-fill with empty strings for unconfigured, blank for configured
    // (we don't send actual values to the client)
    const initial: Record<string, string> = {}
    for (const v of vars) {
      initial[v.key] = ''
    }
    setEditing((prev) => ({ ...prev, [modId]: initial }))
    setSaveResults({})
  }

  const cancelEditing = (modId: string) => {
    setEditing((prev) => {
      const next = { ...prev }
      delete next[modId]
      return next
    })
  }

  const updateField = (modId: string, key: string, value: string) => {
    setEditing((prev) => ({
      ...prev,
      [modId]: { ...prev[modId], [key]: value },
    }))
  }

  const saveModule = async (modId: string) => {
    const fields = editing[modId]
    if (!fields) return

    // Only send fields that have been filled in (non-empty)
    const updates = Object.entries(fields)
      .filter(([, value]) => value.trim() !== '')
      .map(([key, value]) => ({ key, value: value.trim() }))

    if (updates.length === 0) {
      cancelEditing(modId)
      return
    }

    setSaving(modId)
    setSaveResults({})

    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      })

      const data = await res.json()
      const resultMap: Record<string, { ok: boolean; error?: string }> = {}
      for (const r of data.results || []) {
        resultMap[r.key] = { ok: r.ok, error: r.error }
      }
      setSaveResults(resultMap)

      // If all succeeded, close editor and refresh
      if (data.results?.every((r: { ok: boolean }) => r.ok)) {
        setTimeout(() => {
          cancelEditing(modId)
          fetchModules()
          setSaveResults({})
        }, 1500)
      }
    } catch {
      setSaveResults({ _global: { ok: false, error: 'Network error — could not save' } })
    } finally {
      setSaving(null)
    }
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
            Module status and environment setup — edit values to activate modules
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
          <div className="ml-auto">
            <button
              onClick={() => { setLoading(true); fetchModules().finally(() => setLoading(false)) }}
              className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              Refresh
            </button>
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
          const isEditing = !!editing[mod.id]
          const isSaving = saving === mod.id

          return (
            <Card key={mod.id} className="p-0 overflow-hidden">
              {/* Module header */}
              <button
                onClick={() => toggleExpand(mod.id)}
                className="w-full flex items-center gap-3 sm:gap-4 p-4 sm:p-5 text-left hover:bg-slate-700/20 active:bg-slate-700/30 transition-colors"
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
                    {!mod.editable && (
                      <Badge variant="gray">
                        <Lock className="h-2.5 w-2.5 mr-1" />
                        Env only
                      </Badge>
                    )}
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
                          <div className="flex items-center gap-2 flex-wrap">
                            <code className="text-xs text-slate-200 font-mono bg-slate-700/50 px-1.5 py-0.5 rounded">
                              {v.key}
                            </code>
                            {v.configured && (
                              <span className="text-[10px] text-emerald-400">
                                {v.source === 'database' ? 'set (database)' : 'set (env)'}
                              </span>
                            )}
                            {v.configured && v.maskedValue && (
                              <code className="text-[10px] text-slate-500 font-mono">
                                {v.maskedValue}
                              </code>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {v.label} — {v.hint}
                          </p>

                          {/* Inline edit field */}
                          {isEditing && (
                            <div className="mt-2">
                              <input
                                type="text"
                                placeholder={v.configured ? 'Leave blank to keep current value' : `Paste ${v.label} here...`}
                                value={editing[mod.id]?.[v.key] || ''}
                                onChange={(e) => updateField(mod.id, v.key, e.target.value)}
                                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 min-h-[44px] text-sm text-slate-200 font-mono placeholder:text-slate-500 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30"
                                autoComplete="off"
                                autoCorrect="off"
                                autoCapitalize="off"
                              />
                              {saveResults[v.key] && !saveResults[v.key].ok && (
                                <p className="text-[10px] text-red-400 mt-1">{saveResults[v.key].error}</p>
                              )}
                              {saveResults[v.key]?.ok && (
                                <p className="text-[10px] text-emerald-400 mt-1">Saved</p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Global save error */}
                  {saveResults._global && !saveResults._global.ok && (
                    <div className="mt-3 rounded-lg bg-red-500/10 border border-red-500/20 p-2">
                      <p className="text-xs text-red-400">{saveResults._global.error}</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="mt-4 pt-3 border-t border-slate-700/30 flex items-center gap-3 flex-wrap">
                    {mod.editable && !isEditing && (
                      <Button
                        size="sm"
                        onClick={(e: React.MouseEvent) => {
                          e.stopPropagation()
                          startEditing(mod.id, mod.vars)
                        }}
                      >
                        <Pencil className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                    )}

                    {isEditing && (
                      <>
                        <Button
                          size="sm"
                          onClick={(e: React.MouseEvent) => {
                            e.stopPropagation()
                            saveModule(mod.id)
                          }}
                          disabled={isSaving}
                        >
                          {isSaving ? (
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          ) : (
                            <Save className="h-3 w-3 mr-1" />
                          )}
                          {isSaving ? 'Saving...' : 'Save & Activate'}
                        </Button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            cancelEditing(mod.id)
                          }}
                          className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors"
                        >
                          <X className="h-3 w-3" />
                          Cancel
                        </button>
                      </>
                    )}

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

      {/* Help notes */}
      <Card className="bg-amber-500/5 border-amber-500/20">
        <div className="flex items-start gap-3">
          <Settings className="h-5 w-5 text-amber-400 mt-0.5" />
          <div>
            <p className="text-sm text-slate-200 font-medium">How config works</p>
            <p className="text-xs text-slate-400 mt-1">
              Values saved here are stored in your Supabase database and take effect immediately — no redeploy needed.
              They override any matching Vercel environment variables. Modules marked
              <code className="bg-slate-700/50 px-1 py-0.5 rounded text-slate-300 mx-1">Env only</code>
              (Supabase and Clerk) must be set via Vercel since they&apos;re required before the database is available.
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
