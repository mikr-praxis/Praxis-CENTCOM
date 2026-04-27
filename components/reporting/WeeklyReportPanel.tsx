'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { X, Sparkles, Loader2, Copy, Check, AlertCircle, Clock } from 'lucide-react'
import { useFormatters } from '@/components/providers/BrandingProvider'
import type { ReportAgentRun } from '@/lib/supabase/types'

interface Props {
  slug: string
  open: boolean
  onClose: () => void
}

type RunSummary = Pick<
  ReportAgentRun,
  | 'id'
  | 'period_start'
  | 'period_end'
  | 'status'
  | 'output_markdown'
  | 'error_message'
  | 'kpi_snapshot'
  | 'created_at'
  | 'completed_at'
  | 'model'
  | 'input_tokens'
  | 'output_tokens'
>

/**
 * Right-rail drawer for generating + viewing client weekly reports. Lives
 * outside the page-level state so the parent only owns an `open` boolean.
 */
export function WeeklyReportPanel({ slug, open, onClose }: Props) {
  const f = useFormatters()
  const [runs, setRuns] = useState<RunSummary[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingMigration, setPendingMigration] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true)
    setError(null)
    try {
      const res = await fetch(`/api/reporting/${slug}/agent?limit=20`)
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || `Failed to load (${res.status})`)
      const list = (body.runs ?? []) as RunSummary[]
      setRuns(list)
      setPendingMigration(body.pending_migration ?? null)
      // Auto-select the latest succeeded run, otherwise the latest one regardless
      const latest = list.find((r) => r.status === 'succeeded') ?? list[0]
      setSelectedId(latest?.id ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load report history')
    } finally {
      setLoadingHistory(false)
    }
  }, [slug])

  useEffect(() => {
    if (open) loadHistory()
  }, [open, loadHistory])

  const generate = useCallback(async () => {
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch(`/api/reporting/${slug}/agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || `Generation failed (${res.status})`)
      // Re-pull history so the new row + selection are fresh
      await loadHistory()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }, [slug, loadHistory])

  const selected = useMemo(
    () => runs.find((r) => r.id === selectedId) ?? null,
    [runs, selectedId]
  )

  const copy = useCallback(() => {
    if (!selected?.output_markdown) return
    navigator.clipboard.writeText(selected.output_markdown).then(
      () => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      },
      () => {
        /* clipboard blocked, no-op */
      }
    )
  }, [selected])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <button
        className="flex-1 bg-black/60"
        onClick={onClose}
        aria-label="Close panel"
      />
      {/* Drawer */}
      <aside className="w-full max-w-2xl bg-zinc-950 border-l border-zinc-800 flex flex-col">
        <header className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-400" />
            <h2 className="text-sm font-semibold text-white">Weekly Report</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-zinc-800"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* Generate strip */}
        <div className="px-5 py-3 border-b border-zinc-800 flex items-center gap-3">
          <button
            onClick={generate}
            disabled={generating}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm font-medium hover:bg-amber-500/20 disabled:opacity-50"
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {generating ? 'Generating…' : 'Generate now'}
          </button>
          <p className="text-xs text-slate-500">
            Uses your KPIs and the last 7 days of synced data.
          </p>
        </div>

        {pendingMigration && (
          <div className="mx-5 mt-3 p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-xs text-amber-200">
            Run migration{' '}
            <code className="font-mono">{pendingMigration}</code> in Supabase to
            enable history. The Generate button still works without it but
            results won&apos;t be saved.
          </div>
        )}

        {error && (
          <div className="mx-5 mt-3 p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-xs text-red-300 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span className="break-words">{error}</span>
          </div>
        )}

        <div className="flex flex-1 min-h-0">
          {/* History list */}
          <div className="w-56 border-r border-zinc-800 overflow-y-auto p-3 space-y-1">
            {loadingHistory && runs.length === 0 ? (
              <p className="text-xs text-slate-500 px-2 py-1">Loading…</p>
            ) : runs.length === 0 ? (
              <p className="text-xs text-slate-500 px-2 py-1">
                No reports yet. Click Generate now to create the first one.
              </p>
            ) : (
              runs.map((r) => {
                const dateLabel = r.created_at
                  ? f.dateTime(r.created_at, {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })
                  : 'Unknown'
                const periodLabel =
                  r.period_start && r.period_end
                    ? `${f.date(r.period_start, { month: 'short', day: 'numeric' })} – ${f.date(r.period_end, { month: 'short', day: 'numeric' })}`
                    : '—'
                return (
                  <button
                    key={r.id}
                    onClick={() => setSelectedId(r.id)}
                    className={`block w-full text-left px-2 py-2 rounded-md text-xs transition-colors ${
                      selectedId === r.id
                        ? 'bg-amber-500/10 text-amber-200 border border-amber-500/30'
                        : 'text-slate-300 hover:bg-zinc-800/60 border border-transparent'
                    }`}
                  >
                    <div className="font-medium">{periodLabel}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {dateLabel}
                    </div>
                    <div className="text-[10px] mt-0.5">
                      <StatusPill status={r.status} />
                    </div>
                  </button>
                )
              })
            )}
          </div>

          {/* Selected run body */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {!selected ? (
              <p className="text-sm text-slate-500">
                Select a report from the left, or click Generate now.
              </p>
            ) : selected.status === 'failed' ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-red-300">Generation failed</p>
                <pre className="text-xs text-red-300 whitespace-pre-wrap break-words bg-red-500/5 border border-red-500/20 rounded-lg p-3">
                  {selected.error_message ?? 'Unknown error'}
                </pre>
              </div>
            ) : selected.status !== 'succeeded' ? (
              <p className="text-sm text-slate-400 inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Running…
              </p>
            ) : (
              <article>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-slate-500">
                    {selected.model && (
                      <span className="font-mono">{selected.model}</span>
                    )}
                    {selected.input_tokens != null && selected.output_tokens != null && (
                      <>
                        {' · '}
                        {selected.input_tokens.toLocaleString()} in /{' '}
                        {selected.output_tokens.toLocaleString()} out
                      </>
                    )}
                  </p>
                  <button
                    onClick={copy}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-slate-400 hover:text-slate-100 hover:bg-zinc-800"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3 w-3" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" /> Copy markdown
                      </>
                    )}
                  </button>
                </div>
                <MarkdownLite source={selected.output_markdown ?? ''} />
              </article>
            )}
          </div>
        </div>
      </aside>
    </div>
  )
}

function StatusPill({ status }: { status: ReportAgentRun['status'] }) {
  const cfg: Record<ReportAgentRun['status'], { label: string; className: string }> = {
    succeeded: { label: 'Done', className: 'text-emerald-300 bg-emerald-500/10' },
    running: { label: 'Running', className: 'text-blue-300 bg-blue-500/10' },
    queued: { label: 'Queued', className: 'text-slate-400 bg-slate-500/10' },
    failed: { label: 'Failed', className: 'text-red-300 bg-red-500/10' },
  }
  const c = cfg[status]
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${c.className}`}>
      {c.label}
    </span>
  )
}

/**
 * Tiny markdown renderer covering the surface area the agent prompt actually
 * produces: `# heading`, `## heading`, `**bold**`, `*italic*`, `- bullet`,
 * `\`code\``, blank-line paragraphs. Avoids pulling in a full markdown lib.
 */
function MarkdownLite({ source }: { source: string }) {
  const blocks = source.split(/\n{2,}/)
  return (
    <div className="prose prose-invert prose-sm max-w-none text-slate-200 space-y-3">
      {blocks.map((block, i) => {
        const trimmed = block.trim()
        if (!trimmed) return null
        // Heading
        const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/)
        if (headingMatch) {
          const level = headingMatch[1].length
          const text = headingMatch[2]
          if (level === 1)
            return (
              <h1 key={i} className="text-lg font-semibold text-white">
                {renderInline(text)}
              </h1>
            )
          if (level === 2)
            return (
              <h2 key={i} className="text-base font-semibold text-white mt-2">
                {renderInline(text)}
              </h2>
            )
          return (
            <h3 key={i} className="text-sm font-semibold text-slate-100 mt-1">
              {renderInline(text)}
            </h3>
          )
        }
        // List
        if (/^\s*[-*]\s+/m.test(trimmed) && trimmed.split('\n').every((l) => /^\s*[-*]\s+/.test(l) || l.trim() === '')) {
          const items = trimmed
            .split('\n')
            .map((l) => l.replace(/^\s*[-*]\s+/, ''))
            .filter(Boolean)
          return (
            <ul key={i} className="list-disc pl-5 space-y-1 text-sm">
              {items.map((it, j) => (
                <li key={j}>{renderInline(it)}</li>
              ))}
            </ul>
          )
        }
        // Numbered list
        if (/^\s*\d+\.\s+/m.test(trimmed) && trimmed.split('\n').every((l) => /^\s*\d+\.\s+/.test(l) || l.trim() === '')) {
          const items = trimmed
            .split('\n')
            .map((l) => l.replace(/^\s*\d+\.\s+/, ''))
            .filter(Boolean)
          return (
            <ol key={i} className="list-decimal pl-5 space-y-1 text-sm">
              {items.map((it, j) => (
                <li key={j}>{renderInline(it)}</li>
              ))}
            </ol>
          )
        }
        // Paragraph
        return (
          <p key={i} className="text-sm leading-relaxed">
            {renderInline(trimmed)}
          </p>
        )
      })}
    </div>
  )
}

/** Inline rendering: **bold**, *italic*, `code`. */
function renderInline(text: string): React.ReactNode {
  // Tokenize on **…**, *…*, `…`. Simple greedy scan.
  const parts: React.ReactNode[] = []
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  let key = 0
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index))
    const tok = match[0]
    if (tok.startsWith('**')) {
      parts.push(
        <strong key={key++} className="font-semibold text-white">
          {tok.slice(2, -2)}
        </strong>
      )
    } else if (tok.startsWith('`')) {
      parts.push(
        <code key={key++} className="font-mono text-xs px-1 py-0.5 rounded bg-zinc-800 text-amber-200">
          {tok.slice(1, -1)}
        </code>
      )
    } else {
      parts.push(
        <em key={key++} className="italic text-slate-100">
          {tok.slice(1, -1)}
        </em>
      )
    }
    lastIndex = match.index + tok.length
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  return parts
}
