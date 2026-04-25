'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X } from 'lucide-react'

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/['"`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

interface Props {
  /** Default funnel type for new clients (from REPORTING_DEFAULT_FUNNEL_TYPE config). */
  defaultFunnelType?: 'call' | 'webinar' | 'challenge'
}

export function AddClientButton({ defaultFunnelType = 'call' }: Props = {}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [funnel, setFunnel] = useState<'call' | 'webinar' | 'challenge'>(defaultFunnelType)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function setNameAndSlug(v: string) {
    setName(v)
    // Auto-update slug only if user hasn't manually edited it
    setSlug((prev) => (prev === '' || prev === slugify(name)) ? slugify(v) : prev)
  }

  async function submit() {
    if (!name.trim()) {
      setError('Name is required')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim() || slugify(name),
          funnel_type: funnel,
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || `Create failed (${res.status})`)
      setOpen(false)
      setName('')
      setSlug('')
      setFunnel(defaultFunnelType)
      // Navigate straight to the new client's report
      router.push(`/reporting/${body.client.slug}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm font-medium hover:bg-amber-500/20"
      >
        <Plus className="h-4 w-4" />
        Add Client
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => !submitting && setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Add client</h2>
              <button
                onClick={() => !submitting && setOpen(false)}
                className="p-1 rounded hover:bg-slate-800 text-slate-400"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <label className="block">
                <span className="block text-xs text-slate-400 mb-1">Name</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setNameAndSlug(e.target.value)}
                  placeholder="Breathe for Change"
                  autoFocus
                  className="w-full px-3 py-2 rounded-lg bg-slate-950/60 border border-slate-700 text-sm text-slate-200 focus:outline-none focus:border-amber-500/50"
                />
              </label>

              <label className="block">
                <span className="block text-xs text-slate-400 mb-1">Slug</span>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="breathe-for-change"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950/60 border border-slate-700 text-sm text-slate-200 font-mono focus:outline-none focus:border-amber-500/50"
                />
                <span className="block text-[11px] text-slate-500 mt-1">
                  Used in URLs: <span className="font-mono">/reporting/{slug || slugify(name) || 'slug'}</span>
                </span>
              </label>

              <label className="block">
                <span className="block text-xs text-slate-400 mb-1">Funnel type</span>
                <select
                  value={funnel}
                  onChange={(e) => setFunnel(e.target.value as 'call' | 'webinar' | 'challenge')}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950/60 border border-slate-700 text-sm text-slate-200 focus:outline-none focus:border-amber-500/50"
                >
                  <option value="call">Call funnel</option>
                  <option value="webinar">Webinar funnel</option>
                  <option value="challenge">Challenge funnel</option>
                </select>
                <span className="block text-[11px] text-slate-500 mt-1">
                  Used by the legacy /dashboard. Reporting KPIs are independent of this — pick whatever fits best.
                </span>
              </label>

              {error && <p className="text-sm text-red-400">{error}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => !submitting && setOpen(false)}
                  className="px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-slate-800 border border-slate-700"
                >
                  Cancel
                </button>
                <button
                  onClick={submit}
                  disabled={submitting}
                  className="px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm font-medium hover:bg-amber-500/20 disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
