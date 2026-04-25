'use client'

import { useState } from 'react'
import { FolderInput, Search } from 'lucide-react'

interface Subfolder {
  id: string
  name: string
}

interface Props {
  slug: string
  clientName: string
  /** Initial drive_folder_id — null/undefined when not yet connected. */
  initialFolderId: string | null
  /** Force-show the configurator even when a folder is already connected. */
  defaultOpen?: boolean
}

export function DriveFolderConfigurator({
  slug,
  clientName,
  initialFolderId,
  defaultOpen = false,
}: Props) {
  const [folderId, setFolderId] = useState(initialFolderId ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [browseOpen, setBrowseOpen] = useState(false)
  const [parentId, setParentId] = useState('')
  const [browsing, setBrowsing] = useState(false)
  const [browseError, setBrowseError] = useState<string | null>(null)
  const [browseHint, setBrowseHint] = useState<string | null>(null)
  const [browseLeafId, setBrowseLeafId] = useState<string | null>(null)
  const [subfolders, setSubfolders] = useState<Subfolder[]>([])

  const [open, setOpen] = useState(defaultOpen || !initialFolderId)

  async function save() {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const res = await fetch(`/api/reporting/${slug}/folder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drive_folder_id: folderId.trim() || null }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Save failed (${res.status})`)
      }
      setSaved(true)
      setTimeout(() => {
        window.location.reload()
      }, 600)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function listFolderTest() {
    if (!folderId.trim()) return
    setBrowsing(true)
    setError(null)
    try {
      const res = await fetch(`/api/reporting/${slug}/folder/list`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Drive list failed (${res.status})`)
      }
      const body = await res.json()
      alert(
        body.files?.length
          ? `Drive folder OK. Found ${body.files.length} files:\n\n` +
              body.files.map((f: { name: string; mimeType: string }) => `• ${f.name} (${f.mimeType})`).join('\n')
          : 'Drive folder OK but it has no files yet.'
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Drive list failed')
    } finally {
      setBrowsing(false)
    }
  }

  async function browseFolders() {
    setBrowsing(true)
    setBrowseError(null)
    setBrowseHint(null)
    setBrowseLeafId(null)
    try {
      const res = await fetch('/api/reporting/drive/list-subfolders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentId: parentId.trim(), remember: true }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || `Browse failed (${res.status})`)
      setSubfolders(body.folders ?? [])
      if (body.hint) setBrowseHint(body.hint)
      if ((body.folders?.length ?? 0) === 0 && body.meta) {
        setBrowseLeafId(body.parentId)
      }
    } catch (e) {
      setBrowseError(e instanceof Error ? e.message : 'Browse failed')
      setSubfolders([])
    } finally {
      setBrowsing(false)
    }
  }

  function pickFolder(id: string) {
    setFolderId(id)
    setBrowseOpen(false)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-slate-500 hover:text-slate-300 inline-flex items-center gap-1"
      >
        <FolderInput className="h-3 w-3" /> Change Drive folder
      </button>
    )
  }

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-900 p-3">
      <div className="flex items-center gap-2 mb-2">
        <FolderInput className="h-4 w-4 text-slate-400" />
        <h3 className="text-sm font-semibold text-white">Drive folder</h3>
        {initialFolderId && (
          <button
            onClick={() => setOpen(false)}
            className="ml-auto text-xs text-slate-500 hover:text-slate-300"
          >
            Hide
          </button>
        )}
      </div>
      <p className="text-xs text-slate-400 mb-3">
        Paste the folder ID for <span className="font-mono text-slate-300">{clientName}</span> from the{' '}
        <span className="font-mono text-slate-300">Client Raw Data for AI</span> Drive folder. The ID is the segment after{' '}
        <span className="font-mono text-slate-300">/folders/</span> in the URL.
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={folderId}
          onChange={(e) => setFolderId(e.target.value)}
          placeholder="1AbCdEf… (Drive folder ID or URL)"
          className="flex-1 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/50"
        />
        <button
          onClick={() => setBrowseOpen(true)}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-slate-700 text-sm text-slate-300 hover:bg-slate-800"
        >
          <Search className="h-4 w-4" /> Browse
        </button>
        <button
          onClick={listFolderTest}
          disabled={!initialFolderId || browsing}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-slate-700 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50"
        >
          Test
        </button>
        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm font-medium hover:bg-amber-500/20 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
      {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
      {saved && <p className="text-emerald-400 text-xs mt-2">Saved. Reloading…</p>}

      {browseOpen && (
        <div className="mt-3 p-3 rounded-lg border border-slate-700 bg-slate-950/40 space-y-2">
          <p className="text-xs text-slate-400">
            Paste the parent folder ID (e.g.{' '}
            <span className="font-mono text-slate-300">Client Raw Data for AI</span>). I&apos;ll list its subfolders.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              placeholder="Parent folder ID"
              className="flex-1 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-200"
            />
            <button
              onClick={browseFolders}
              disabled={browsing || !parentId.trim()}
              className="px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm hover:bg-amber-500/20 disabled:opacity-50"
            >
              {browsing ? 'Listing…' : 'List subfolders'}
            </button>
            <button
              onClick={() => setBrowseOpen(false)}
              className="px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-slate-800 border border-slate-700"
            >
              Cancel
            </button>
          </div>
          {browseError && <p className="text-red-400 text-xs">{browseError}</p>}
          {subfolders.length > 0 && (
            <div className="rounded border border-slate-700 max-h-64 overflow-y-auto">
              {subfolders.map((f) => (
                <button
                  key={f.id}
                  onClick={() => pickFolder(f.id)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-slate-800 border-b border-slate-800 last:border-b-0 flex items-center justify-between gap-2"
                >
                  <span className="text-slate-200 truncate">{f.name}</span>
                  <span className="text-[10px] font-mono text-slate-500 truncate">{f.id}</span>
                </button>
              ))}
            </div>
          )}
          {browseHint && !browseError && subfolders.length === 0 && (
            <div className="rounded border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-200 space-y-2">
              <p>{browseHint}</p>
              {browseLeafId && (
                <button
                  onClick={() => pickFolder(browseLeafId)}
                  className="px-2 py-1 rounded bg-amber-500/20 border border-amber-500/40 text-amber-100 text-xs hover:bg-amber-500/30"
                >
                  Use this folder for {clientName}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
