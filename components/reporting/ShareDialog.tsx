'use client'

import { useEffect, useState } from 'react'
import { X, Copy, Check, Trash2, Plus } from 'lucide-react'

interface ShareToken {
  id: string
  token: string
  label: string | null
  created_at: string
  expires_at: string | null
  revoked_at: string | null
}

interface Props {
  slug: string
  open: boolean
  onClose: () => void
}

export function ShareDialog({ slug, open, onClose }: Props) {
  const [tokens, setTokens] = useState<ShareToken[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [label, setLabel] = useState('')
  const [expiryMode, setExpiryMode] = useState<'default' | 'never' | 'custom'>('default')
  const [customExpiry, setCustomExpiry] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    fetch(`/api/reporting/${slug}/share`)
      .then((r) => r.json())
      .then((b) => setTokens(b.tokens ?? []))
      .catch(() => setError('Failed to load tokens'))
      .finally(() => setLoading(false))
  }, [open, slug])

  async function createToken() {
    setCreating(true)
    setError(null)
    try {
      const body_: { label: string | null; expires_at?: string | null; never_expires?: boolean } = {
        label: label || null,
      }
      if (expiryMode === 'never') body_.never_expires = true
      else if (expiryMode === 'custom' && customExpiry) {
        body_.expires_at = new Date(customExpiry).toISOString()
      }
      // 'default' → omit expires_at; server uses SHARE_TOKEN_DEFAULT_EXPIRY_DAYS

      const res = await fetch(`/api/reporting/${slug}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body_),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Failed to create token')
      setTokens((prev) => [body.token, ...prev])
      setLabel('')
      setExpiryMode('default')
      setCustomExpiry('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed')
    } finally {
      setCreating(false)
    }
  }

  async function revokeToken(id: string) {
    if (!confirm('Revoke this share link? Anyone with the URL will lose access.')) return
    try {
      const res = await fetch(`/api/reporting/${slug}/share/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Revoke failed')
      }
      setTokens((prev) =>
        prev.map((t) => (t.id === id ? { ...t, revoked_at: new Date().toISOString() } : t))
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Revoke failed')
    }
  }

  function copy(id: string, token: string) {
    const url = `${window.location.origin}/reporting/share/${token}`
    navigator.clipboard.writeText(url)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-xl border border-slate-700 bg-slate-900 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Share this report</h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-800 text-slate-400"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-xs text-slate-400 mb-4">
          Generate a public link your client can use to view this report. No login required.
          You can revoke access at any time.
        </p>

        <div className="space-y-2 mb-4">
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label (optional, e.g. 'For Krista')"
            className="w-full px-3 py-2 rounded-lg bg-slate-950/60 border border-slate-700 text-sm text-slate-200"
          />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500">Expires:</span>
            <div className="flex items-center gap-1 rounded-md border border-slate-700 p-0.5 bg-slate-900">
              {(['default', 'never', 'custom'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setExpiryMode(m)}
                  className={
                    expiryMode === m
                      ? 'px-2 py-1 text-[11px] rounded bg-amber-500/15 text-amber-300 border border-amber-500/30'
                      : 'px-2 py-1 text-[11px] rounded text-slate-400 hover:text-slate-200 border border-transparent'
                  }
                >
                  {m === 'default' ? 'Default (config)' : m === 'never' ? 'Never' : 'Custom'}
                </button>
              ))}
            </div>
            {expiryMode === 'custom' && (
              <input
                type="date"
                value={customExpiry}
                onChange={(e) => setCustomExpiry(e.target.value)}
                className="px-2 py-1 text-xs rounded bg-slate-950 border border-slate-700 text-slate-200"
              />
            )}
            <button
              onClick={createToken}
              disabled={creating || (expiryMode === 'custom' && !customExpiry)}
              className="ml-auto inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm font-medium hover:bg-amber-500/20 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              {creating ? 'Creating...' : 'New link'}
            </button>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-400 mb-3">{error}</p>
        )}

        <div className="space-y-2 max-h-80 overflow-y-auto">
          {loading ? (
            <p className="text-sm text-slate-500">Loading...</p>
          ) : tokens.length === 0 ? (
            <p className="text-sm text-slate-500">No share links yet.</p>
          ) : (
            tokens.map((t) => {
              const url = typeof window !== 'undefined' ? `${window.location.origin}/reporting/share/${t.token}` : ''
              const revoked = !!t.revoked_at
              return (
                <div
                  key={t.id}
                  className={`p-3 rounded-lg border ${revoked ? 'border-slate-800 bg-slate-900/30 opacity-60' : 'border-slate-700 bg-slate-950/40'}`}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0">
                      <p className="text-sm text-slate-200 truncate">
                        {t.label || 'Untitled link'}
                        {revoked && <span className="ml-2 text-xs text-red-400">revoked</span>}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Created {new Date(t.created_at).toLocaleString()}
                        {t.expires_at ? (
                          new Date(t.expires_at).getTime() < Date.now() ? (
                            <span className="ml-2 text-red-400">expired {new Date(t.expires_at).toLocaleDateString()}</span>
                          ) : (
                            <span className="ml-2 text-amber-400">expires {new Date(t.expires_at).toLocaleDateString()}</span>
                          )
                        ) : (
                          <span className="ml-2 text-slate-600">no expiry</span>
                        )}
                      </p>
                    </div>
                    {!revoked && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => copy(t.id, t.token)}
                          className="p-1.5 rounded hover:bg-slate-800 text-slate-400"
                          title="Copy link"
                        >
                          {copiedId === t.id ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                        </button>
                        <button
                          onClick={() => revokeToken(t.id)}
                          className="p-1.5 rounded hover:bg-red-500/10 text-red-400"
                          title="Revoke"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                  {!revoked && (
                    <div className="text-[11px] font-mono text-slate-500 truncate" title={url}>
                      {url}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
