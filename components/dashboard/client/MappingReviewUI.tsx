'use client'

import { useState } from 'react'
import { Check, X, AlertTriangle, HelpCircle, Loader2 } from 'lucide-react'
import type { MapperResult, MappingProposal, AmbiguousMapping } from '@/lib/metrics/types'

interface MappingReviewUIProps {
  clientSlug: string
  clientName: string
  funnelType: string
  dataSourceId: string
  mapping: MapperResult
  sheetData: Array<{ name: string; headers: string[]; sampleRows: string[][]; allRows?: string[][] }>
  onApproved: () => void
}

export function MappingReviewUI({
  clientSlug,
  clientName,
  funnelType,
  dataSourceId,
  mapping,
  sheetData,
  onApproved,
}: MappingReviewUIProps) {
  const [approvedMappings, setApprovedMappings] = useState<Set<number>>(
    new Set(mapping.mappings.map((_, i) => i))
  )
  const [resolvedAmbiguities, setResolvedAmbiguities] = useState<Record<number, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggleMapping(index: number) {
    const next = new Set(approvedMappings)
    if (next.has(index)) next.delete(index)
    else next.add(index)
    setApprovedMappings(next)
  }

  function resolveAmbiguity(index: number, metric: string) {
    setResolvedAmbiguities(prev => ({ ...prev, [index]: metric }))
  }

  async function handleApprove() {
    setSubmitting(true)
    setError(null)

    const approved = mapping.mappings
      .filter((_, i) => approvedMappings.has(i))
      .map(m => ({
        raw_column: m.raw_column,
        tab: m.tab,
        canonical_metric: m.canonical_metric,
        confidence: m.confidence,
      }))

    // Add resolved ambiguities as direct mappings
    for (const [indexStr, metric] of Object.entries(resolvedAmbiguities)) {
      const amb = mapping.ambiguities[Number(indexStr)]
      if (amb && metric) {
        approved.push({
          raw_column: amb.raw_column,
          tab: amb.tab,
          canonical_metric: metric,
          confidence: 'direct',
        })
      }
    }

    try {
      const res = await fetch(`/api/clients/${clientSlug}/metrics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataSourceId, approvedMappings: approved, sheetData }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to approve mappings')
      }

      onApproved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-100">{clientName} — Mapping Review</h2>
          <p className="text-sm text-slate-400 mt-1">
            Funnel: <span className="text-amber-400">{funnelType}</span> · Review the AI-proposed column mappings before importing data.
          </p>
        </div>
      </div>

      {/* Direct Matches */}
      {mapping.mappings.length > 0 && (
        <Section title="Direct Matches" icon={<Check className="h-4 w-4 text-emerald-400" />} count={mapping.mappings.length}>
          {mapping.mappings.map((m, i) => (
            <MappingRow
              key={i}
              mapping={m}
              approved={approvedMappings.has(i)}
              onToggle={() => toggleMapping(i)}
            />
          ))}
        </Section>
      )}

      {/* Derived Metrics */}
      {mapping.derived_metrics.length > 0 && (
        <Section title="Derived Metrics" icon={<AlertTriangle className="h-4 w-4 text-amber-400" />} count={mapping.derived_metrics.length}>
          {mapping.derived_metrics.map((d, i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-amber-400/5 border border-amber-400/20">
              <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-200">{d.canonical_metric}</p>
                <p className="text-xs text-slate-400 mt-0.5">Formula: {d.formula}</p>
                <p className="text-xs text-slate-500 mt-0.5">{d.notes}</p>
              </div>
            </div>
          ))}
        </Section>
      )}

      {/* Ambiguities */}
      {mapping.ambiguities.length > 0 && (
        <Section title="Needs Your Input" icon={<HelpCircle className="h-4 w-4 text-blue-400" />} count={mapping.ambiguities.length}>
          {mapping.ambiguities.map((amb, i) => (
            <AmbiguityRow
              key={i}
              ambiguity={amb}
              resolved={resolvedAmbiguities[i]}
              onResolve={(metric) => resolveAmbiguity(i, metric)}
            />
          ))}
        </Section>
      )}

      {/* Missing Metrics */}
      {mapping.missing_metrics.length > 0 && (
        <Section title="Missing Metrics" icon={<X className="h-4 w-4 text-red-400" />} count={mapping.missing_metrics.length}>
          <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20">
            <div className="flex flex-wrap gap-2">
              {mapping.missing_metrics.map((key) => (
                <span key={key} className="px-2 py-1 text-xs rounded bg-red-500/10 text-red-400 border border-red-500/20">
                  {key}
                </span>
              ))}
            </div>
            {mapping.missing_notes && (
              <p className="text-xs text-slate-400 mt-2">{mapping.missing_notes}</p>
            )}
          </div>
        </Section>
      )}

      {/* Approve Button */}
      <div className="flex items-center gap-4 pt-4 border-t border-zinc-800">
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          onClick={handleApprove}
          disabled={submitting || approvedMappings.size === 0}
          className="ml-auto flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Approve & Import ({approvedMappings.size} mappings)
        </button>
      </div>
    </div>
  )
}

function Section({ title, icon, count, children }: {
  title: string
  icon: React.ReactNode
  count: number
  children: React.ReactNode
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="text-sm font-semibold text-slate-300">{title}</h3>
        <span className="text-xs text-slate-500">({count})</span>
      </div>
      <div className="space-y-2">
        {children}
      </div>
    </div>
  )
}

function MappingRow({ mapping, approved, onToggle }: {
  mapping: MappingProposal
  approved: boolean
  onToggle: () => void
}) {
  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
        approved
          ? 'bg-emerald-500/5 border-emerald-500/20'
          : 'bg-zinc-900 border-zinc-800 opacity-60'
      }`}
      onClick={onToggle}
    >
      <div className={`flex-shrink-0 h-5 w-5 rounded border flex items-center justify-center ${
        approved ? 'bg-emerald-500 border-emerald-500' : 'border-zinc-600'
      }`}>
        {approved && <Check className="h-3 w-3 text-white" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-300 font-mono">{mapping.raw_column}</span>
          <span className="text-slate-600">→</span>
          <span className="text-sm text-emerald-400 font-medium">{mapping.canonical_metric}</span>
        </div>
        <p className="text-xs text-slate-500 mt-0.5">
          Tab: {mapping.tab} · {mapping.notes}
        </p>
      </div>
      <span className={`text-xs px-2 py-0.5 rounded ${
        mapping.confidence === 'direct' ? 'bg-emerald-500/10 text-emerald-400' :
        mapping.confidence === 'derived' ? 'bg-amber-400/10 text-amber-400' :
        'bg-zinc-700 text-zinc-400'
      }`}>
        {mapping.confidence}
      </span>
    </div>
  )
}

function AmbiguityRow({ ambiguity, resolved, onResolve }: {
  ambiguity: AmbiguousMapping
  resolved: string | undefined
  onResolve: (metric: string) => void
}) {
  return (
    <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20 space-y-2">
      <div className="flex items-start gap-2">
        <HelpCircle className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm text-slate-200">
            <span className="font-mono">{ambiguity.raw_column}</span>
            <span className="text-slate-500"> in </span>
            <span className="text-slate-400">{ambiguity.tab}</span>
          </p>
          <p className="text-xs text-slate-400 mt-1">{ambiguity.question}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 pl-6">
        {ambiguity.possible_mappings.map((metric) => (
          <button
            key={metric}
            onClick={() => onResolve(metric)}
            className={`px-3 py-1 text-xs rounded-lg border transition-colors ${
              resolved === metric
                ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                : 'bg-zinc-800 border-zinc-700 text-slate-400 hover:border-blue-500/30'
            }`}
          >
            {metric}
          </button>
        ))}
        <button
          onClick={() => onResolve('')}
          className={`px-3 py-1 text-xs rounded-lg border transition-colors ${
            resolved === ''
              ? 'bg-zinc-700 border-zinc-600 text-slate-300'
              : 'bg-zinc-800 border-zinc-700 text-slate-500 hover:border-zinc-600'
          }`}
        >
          Skip
        </button>
      </div>
    </div>
  )
}
