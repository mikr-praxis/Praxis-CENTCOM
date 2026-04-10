'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import {
  LayoutDashboard,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Archive,
  Trash2,
  Users,
  Clock,
  AlertCircle,
  CheckCircle2,
  Circle,
  Search,
  Filter,
  ExternalLink,
  Loader2,
  CloudOff,
  Database,
  Zap,
} from 'lucide-react'

type MondayTask = {
  id: string
  name: string
  boardName: string
  boardId: string
  groupName: string
  groupId: string
  status: string | null
  dueDate: string | null
  assignees: { id: string; name: string }[]
  priority: string | null
  timelineStart: string | null
  timelineEnd: string | null
}

type MondayBoard = {
  id: string
  name: string
  board_kind: string
  state: string
  columns: { id: string; title: string; type: string }[]
}

type ErrorInfo = {
  error: string
  errorCode?: string
  retryAfter?: number
}

// ââ Status color helper ââââââââââââââââââââââââââââââââââââââââââââââââ

function statusColor(status: string | null): string {
  if (!status) return 'bg-slate-600'
  const s = status.toLowerCase()
  if (s.includes('done') || s.includes('complete')) return 'bg-emerald-500'
  if (s.includes('working') || s.includes('progress') || s.includes('active')) return 'bg-blue-500'
  if (s.includes('stuck') || s.includes('blocked')) return 'bg-red-500'
  if (s.includes('review')) return 'bg-amber-500'
  if (s.includes('waiting') || s.includes('pending')) return 'bg-purple-500'
  return 'bg-slate-500'
}

function priorityColor(priority: string | null): string {
  if (!priority) return 'text-slate-500'
  const p = priority.toLowerCase()
  if (p.includes('critical') || p.includes('urgent')) return 'text-red-400'
  if (p.includes('high')) return 'text-amber-400'
  if (p.includes('medium')) return 'text-blue-400'
  if (p.includes('low')) return 'text-slate-400'
  return 'text-slate-400'
}

function deadlineLabel(dateStr: string): { text: string; color: string } {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const date = new Date(dateStr + 'T00:00:00')
  const diff = Math.round((date.getTime() - today.getTime()) / 86400000)

  if (diff < 0) return { text: `${Math.abs(diff)}d overdue`, color: 'text-red-400 bg-red-500/10' }
  if (diff === 0) return { text: 'Due today', color: 'text-amber-400 bg-amber-500/10' }
  if (diff === 1) return { text: 'Tomorrow', color: 'text-amber-400 bg-amber-500/10' }
  if (diff <= 7) return { text: `${diff}d left`, color: 'text-blue-400 bg-blue-500/10' }
  return { text: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), color: 'text-slate-400 bg-slate-500/10' }
}

const ITEMS_PER_PAGE = 25

// ââ Component ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

export function MondayClient() {
  const [tasks, setTasks] = useState<MondayTask[]>([])
  const [boards, setBoards] = useState<MondayBoard[]>([])
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<ErrorInfo | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncStatus, setSyncStatus] = useState<{ lastSync: string | null; cachedCount: number } | null>(null)

  // Filters
  const [search, setSearch] = useState('')
  const [selectedBoard, setSelectedBoard] = useState<string | null>(null)
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null)
  const [selectedAssignee, setSelectedAssignee] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'dueDate' | 'name' | 'status' | 'priority'>('dueDate')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  // Pagination
  const [page, setPage] = useState(0)

  // Archive/delete confirmations
  const [archiving, setArchiving] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  // Expanded board cards
  const [expandedBoards, setExpandedBoards] = useState<Set<string>>(new Set())

  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchTasks = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    setError(null)

    try {
      const [tasksRes, boardsRes] = await Promise.all([
        fetch('/api/monday'),
        fetch('/api/monday?action=boards'),
      ])

      if (tasksRes.ok) {
        const data = await tasksRes.json()
        setTasks(data.tasks || [])
        setConnected(data.connected)

        if (data.errorCode) {
          setError({ error: data.error, errorCode: data.errorCode, retryAfter: data.retryAfter })
        }
      } else {
        const data = await tasksRes.json()
        setError({ error: data.error || 'Failed to fetch', errorCode: data.errorCode })
        setConnected(data.connected ?? false)
      }

      if (boardsRes.ok) {
        const data = await boardsRes.json()
        setBoards(data.boards || [])
      }
    } catch (err) {
      setError({ error: 'Network error â could not reach the server', errorCode: 'NETWORK_ERROR' })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  const fetchSyncStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/monday?action=sync-status')
      if (res.ok) {
        const data = await res.json()
        setSyncStatus(data)
      }
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    fetchTasks()
    fetchSyncStatus()

    autoRefreshRef.current = setInterval(() => fetchTasks(true), 60_000)
    return () => { if (autoRefreshRef.current) clearInterval(autoRefreshRef.current) }
  }, [fetchTasks, fetchSyncStatus])

  // Visibility refresh
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'visible') fetchTasks(true)
    }
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [fetchTasks])

  const handleSyncAll = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/monday', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync-all' }),
      })
      if (res.ok) {
        await fetchSyncStatus()
        await fetchTasks(true)
      }
    } catch { /* ignore */ }
    finally { setSyncing(false) }
  }

  const handleArchive = async (itemId: string) => {
    setArchiving(itemId)
    try {
      await fetch('/api/monday', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'archive', itemId }),
      })
      setTasks((prev) => prev.filter((t) => t.id !== itemId))
    } catch { /* ignore */ }
    finally { setArchiving(null) }
  }

  const handleDelete = async (itemId: string) => {
    setDeleting(itemId)
    try {
      await fetch('/api/monday', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', itemId }),
      })
      setTasks((prev) => prev.filter((t) => t.id !== itemId))
    } catch { /* ignore */ }
    finally { setDeleting(null) }
  }

  // ââ Derived data ââââââââââââââââââââââââââââââââââââââââââââââââââââ

  const allStatuses = useMemo(() => {
    const set = new Set<string>()
    tasks.forEach((t) => { if (t.status) set.add(t.status) })
    return Array.from(set).sort()
  }, [tasks])

  const allAssignees = useMemo(() => {
    const map = new Map<string, string>()
    tasks.forEach((t) => t.assignees.forEach((a) => map.set(a.id, a.name)))
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [tasks])

  const filtered = useMemo(() => {
    let result = tasks

    if (search) {
      const q = search.toLowerCase()
      result = result.filter((t) =>
        t.name.toLowerCase().includes(q) ||
        t.boardName.toLowerCase().includes(q) ||
        t.groupName.toLowerCase().includes(q)
      )
    }
    if (selectedBoard) result = result.filter((t) => t.boardId === selectedBoard)
    if (selectedStatus) result = result.filter((t) => t.status === selectedStatus)
    if (selectedAssignee) result = result.filter((t) => t.assignees.some((a) => a.id === selectedAssignee))

    // Sort
    result = [...result].sort((a, b) => {
      let cmp = 0
      switch (sortBy) {
        case 'dueDate':
          cmp = (a.dueDate || '9999').localeCompare(b.dueDate || '9999')
          break
        case 'name':
          cmp = a.name.localeCompare(b.name)
          break
        case 'status':
          cmp = (a.status || '').localeCompare(b.status || '')
          break
        case 'priority':
          cmp = (a.priority || '').localeCompare(b.priority || '')
          break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })

    return result
  }, [tasks, search, selectedBoard, selectedStatus, selectedAssignee, sortBy, sortDir])

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE)
  const paged = filtered.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE)

  // Reset page when filters change
  useEffect(() => { setPage(0) }, [search, selectedBoard, selectedStatus, selectedAssignee])

  const toggleSort = (col: typeof sortBy) => {
    if (sortBy === col) setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir('asc') }
  }

  const SortIcon = ({ col }: { col: typeof sortBy }) => (
    sortBy === col
      ? sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
      : <ChevronDown className="h-3 w-3 opacity-30" />
  )

  // ââ Render ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

  return (
    <div className="space-y-6">
      {/* Refresh bar */}
      {refreshing && (
        <div className="fixed top-0 left-0 right-0 z-50 h-0.5">
          <div className="h-full bg-purple-500 animate-pulse" style={{ width: '100%' }} />
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Monday.com</h1>
          <p className="text-sm text-slate-400 mt-1">
            {connected
              ? `${tasks.length} active task${tasks.length !== 1 ? 's' : ''} across ${boards.length} board${boards.length !== 1 ? 's' : ''}`
              : 'Not connected â add your API key at /config'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="secondary" onClick={() => fetchTasks(true)} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="secondary" onClick={handleSyncAll} disabled={syncing}>
            <Database className={`h-4 w-4 mr-1 ${syncing ? 'animate-pulse' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync to Cache'}
          </Button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 flex items-start gap-3">
          {error.errorCode === 'NETWORK_ERROR' ? (
            <CloudOff className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
          ) : error.errorCode === 'RATE_LIMITED' ? (
            <Clock className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
          )}
          <div>
            <p className="text-sm font-medium text-red-300">
              {error.errorCode === 'RATE_LIMITED' ? 'Rate limited by Monday.com' :
               error.errorCode === 'NO_TOKEN' ? 'API key not configured' :
               error.errorCode === 'NETWORK_ERROR' ? 'Network error' :
               'API error'}
            </p>
            <p className="text-xs text-red-400/80 mt-0.5">{error.error}</p>
            {error.retryAfter && (
              <p className="text-xs text-amber-400 mt-1">Retry in {error.retryAfter}s</p>
            )}
          </div>
        </div>
      )}

      {/* Sync status */}
      {syncStatus && (
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <Database className="h-3 w-3" />
            {syncStatus.cachedCount} cached
          </span>
          {syncStatus.lastSync && (
            <span className="flex items-center gap-1">
              <Zap className="h-3 w-3" />
              Last sync: {new Date(syncStatus.lastSync).toLocaleString()}
            </span>
          )}
        </div>
      )}

      {/* Filters */}
      {connected && !loading && (
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Board filter */}
          <select
            value={selectedBoard || ''}
            onChange={(e) => setSelectedBoard(e.target.value || null)}
            className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="">All Boards</option>
            {boards.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>

          {/* Status filter */}
          <select
            value={selectedStatus || ''}
            onChange={(e) => setSelectedStatus(e.target.value || null)}
            className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="">All Statuses</option>
            {allStatuses.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          {/* Assignee filter */}
          <select
            value={selectedAssignee || ''}
            onChange={(e) => setSelectedAssignee(e.target.value || null)}
            className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="">All Assignees</option>
            {allAssignees.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>

          {/* Filter count */}
          <span className="text-xs text-slate-500">
            {filtered.length} task{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Task Table */}
      {loading ? (
        <Card className="p-0 overflow-hidden">
          <div className="animate-pulse space-y-0">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-slate-700/30">
                <div className="w-3 h-3 rounded-full bg-slate-700/40" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 w-1/3 rounded bg-slate-700/30" />
                  <div className="h-2.5 w-1/2 rounded bg-slate-700/20" />
                </div>
                <div className="h-5 w-16 rounded-full bg-slate-700/30" />
              </div>
            ))}
          </div>
        </Card>
      ) : !connected ? (
        <Card className="p-8 text-center">
          <CloudOff className="h-12 w-12 text-slate-600 mx-auto mb-3" />
          <p className="text-lg font-medium text-slate-300">Monday.com not connected</p>
          <p className="text-sm text-slate-500 mt-1">
            Add your MONDAY_API_KEY at <a href="/config" className="text-purple-400 hover:text-purple-300">/config</a> to see tasks here.
          </p>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center">
          <LayoutDashboard className="h-12 w-12 text-slate-600 mx-auto mb-3" />
          <p className="text-lg font-medium text-slate-300">
            {search || selectedBoard || selectedStatus || selectedAssignee ? 'No tasks match your filters' : 'No active tasks'}
          </p>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          {/* Table header */}
          <div className="hidden sm:grid sm:grid-cols-12 gap-2 px-5 py-3 border-b border-slate-700/50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <button className="col-span-4 flex items-center gap-1 text-left hover:text-slate-300" onClick={() => toggleSort('name')}>
              Task <SortIcon col="name" />
            </button>
            <button className="col-span-2 flex items-center gap-1 text-left hover:text-slate-300" onClick={() => toggleSort('status')}>
              Status <SortIcon col="status" />
            </button>
            <button className="col-span-2 flex items-center gap-1 text-left hover:text-slate-300" onClick={() => toggleSort('priority')}>
              Priority <SortIcon col="priority" />
            </button>
            <button className="col-span-2 flex items-center gap-1 text-left hover:text-slate-300" onClick={() => toggleSort('dueDate')}>
              Due <SortIcon col="dueDate" />
            </button>
            <div className="col-span-2 text-right">Actions</div>
          </div>

          {/* Task rows */}
          <div className="divide-y divide-slate-700/30">
            {paged.map((task) => {
              const deadline = task.dueDate ? deadlineLabel(task.dueDate) : null
              const taskDone = task.status?.toLowerCase().includes('done') || task.status?.toLowerCase().includes('complete')
              const displayDeadline = deadline && taskDone && deadline.color.includes('red')
                ? { text: deadline.text.replace(/overdue/, 'late (done)'), color: 'text-slate-500 bg-slate-500/10' }
                : deadline

              return (
                <div
                  key={task.id}
                  className="grid grid-cols-1 sm:grid-cols-12 gap-2 px-5 py-3.5 hover:bg-slate-800/30 transition-colors items-center"
                >
                  {/* Task name + meta */}
                  <div className="sm:col-span-4 min-w-0">
                    <p className="text-sm font-medium text-slate-200 truncate">{task.name}</p>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                      <span className="truncate max-w-[120px]">{task.boardName}</span>
                      <span className="text-slate-600">Â·</span>
                      <span className="truncate max-w-[100px]">{task.groupName}</span>
                      {task.assignees.length > 0 && (
                        <>
                          <span className="text-slate-600">Â·</span>
                          <span className="flex items-center gap-0.5">
                            <Users className="h-3 w-3" />
                            {task.assignees.map((a) => a.name.split(' ')[0]).join(', ')}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Status */}
                  <div className="sm:col-span-2">
                    {task.status && (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-300">
                        <span className={`w-2 h-2 rounded-full ${statusColor(task.status)}`} />
                        {task.status}
                      </span>
                    )}
                  </div>

                  {/* Priority */}
                  <div className="sm:col-span-2">
                    {task.priority && (
                      <span className={`text-xs font-medium ${priorityColor(task.priority)}`}>
                        {task.priority}
                      </span>
                    )}
                  </div>

                  {/* Due date */}
                  <div className="sm:col-span-2">
                    {displayDeadline && (
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${displayDeadline.color}`}>
                        {displayDeadline.text}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="sm:col-span-2 flex items-center justify-end gap-1">
                    <a
                      href={`https://monday.com/boards/${task.boardId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg hover:bg-slate-700/50 text-slate-500 hover:text-slate-300 transition-colors"
                      title="Open in Monday"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                    <button
                      onClick={() => handleArchive(task.id)}
                      disabled={archiving === task.id}
                      className="p-1.5 rounded-lg hover:bg-amber-500/10 text-slate-500 hover:text-amber-400 transition-colors disabled:opacity-50"
                      title="Archive"
                    >
                      {archiving === task.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Archive className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      onClick={() => handleDelete(task.id)}
                      disabled={deleting === task.id}
                      className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-colors disabled:opacity-50"
                      title="Delete"
                    >
                      {deleting === task.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-slate-700/50">
              <span className="text-xs text-slate-500">
                Page {page + 1} of {totalPages} ({filtered.length} tasks)
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(Math.max(0, page - 1))}
                  disabled={page === 0}
                  className="p-2 rounded-lg hover:bg-slate-700/50 text-slate-400 disabled:opacity-30 disabled:cursor-default"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const pageNum = totalPages <= 5 ? i : Math.max(0, Math.min(page - 2, totalPages - 5)) + i
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                        pageNum === page
                          ? 'bg-purple-500/15 text-purple-400 ring-1 ring-purple-500/30'
                          : 'text-slate-400 hover:bg-slate-700/50'
                      }`}
                    >
                      {pageNum + 1}
                    </button>
                  )
                })}
                <button
                  onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                  disabled={page >= totalPages - 1}
                  className="p-2 rounded-lg hover:bg-slate-700/50 text-slate-400 disabled:opacity-30 disabled:cursor-default"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Board overview cards */}
      {connected && boards.length > 0 && !loading && (
        <div>
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Boards</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {boards.map((board) => {
              const boardTasks = tasks.filter((t) => t.boardId === board.id)
              const doneTasks = boardTasks.filter((t) => t.status?.toLowerCase().includes('done') || t.status?.toLowerCase().includes('complete'))
              const overdue = boardTasks.filter((t) => {
                const isDone = (s) => s?.toLowerCase().includes('done') || s?.toLowerCase().includes('complete')
                if (!t.dueDate || isDone(t.status)) return false
                return new Date(t.dueDate + 'T00:00:00') < new Date(new Date().toDateString())
              })
              const isExpanded = expandedBoards.has(board.id)

              return (
                <Card key={board.id} className={`p-0 overflow-hidden transition-colors ${isExpanded ? 'sm:col-span-2 lg:col-span-3 border-slate-600/50' : 'hover:border-slate-600/50'}`}>
                  {/* Card header â clickable */}
                  <button
                    onClick={() => {
                      setExpandedBoards((prev) => {
                        const next = new Set(prev)
                        if (next.has(board.id)) next.delete(board.id)
                        else next.add(board.id)
                        return next
                      })
                    }}
                    className="w-full p-4 text-left hover:bg-slate-800/30 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <ChevronRight className={`h-4 w-4 text-slate-500 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
                        <div>
                          <p className="text-sm font-medium text-slate-200">{board.name}</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {board.board_kind} Â· {board.columns.length} columns
                          </p>
                        </div>
                      </div>
                      <a
                        href={`https://monday.com/boards/${board.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 rounded hover:bg-slate-700/50 text-slate-500 hover:text-slate-300"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                    <div className="flex items-center gap-3 mt-3 ml-6 text-xs">
                      <span className="flex items-center gap-1 text-slate-400">
                        <Circle className="h-3 w-3" />
                        {boardTasks.length} tasks
                      </span>
                      <span className="flex items-center gap-1 text-emerald-400">
                        <CheckCircle2 className="h-3 w-3" />
                        {doneTasks.length} done
                      </span>
                      {overdue.length > 0 && (
                        <span className="flex items-center gap-1 text-red-400">
                          <AlertCircle className="h-3 w-3" />
                          {overdue.length} overdue
                        </span>
                      )}
                    </div>
                    {/* Progress bar */}
                    {boardTasks.length > 0 && (
                      <div className="mt-2 ml-6 h-1.5 rounded-full bg-slate-700/50 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                          style={{ width: `${(doneTasks.length / boardTasks.length) * 100}%` }}
                        />
                      </div>
                    )}
                  </button>

                  {/* Expanded task list */}
                  {isExpanded && boardTasks.length > 0 && (
                    <div className="border-t border-slate-700/50">
                      {/* Column headers */}
                      <div className="grid grid-cols-12 gap-2 px-5 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 bg-slate-800/20">
                        <div className="col-span-5">Task</div>
                        <div className="col-span-2">Status</div>
                        <div className="col-span-3">DRI</div>
                        <div className="col-span-2">Due Date</div>
                      </div>
                      {/* Task rows */}
                      <div className="divide-y divide-slate-700/20 max-h-[400px] overflow-y-auto">
                        {boardTasks
                          .sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'))
                          .map((task) => {
                            const deadline = task.dueDate ? deadlineLabel(task.dueDate) : null
                            // Override overdue styling for completed tasks
                            const taskDone2 = task.status?.toLowerCase().includes('done') || task.status?.toLowerCase().includes('complete')
                            const displayDl = deadline && taskDone2 && deadline.color.includes('red')
                              ? { text: deadline.text.replace(/overdue/, 'late (done)'), color: 'text-slate-500 bg-slate-500/10' }
                              : deadline
                            return (
                              <div key={task.id} className="grid grid-cols-12 gap-2 px-5 py-2.5 hover:bg-slate-800/20 transition-colors items-center text-sm">
                                {/* Task name */}
                                <div className="col-span-5 min-w-0">
                                  <p className="text-slate-200 truncate">{task.name}</p>
                                  <p className="text-[11px] text-slate-500 truncate">{task.groupName}</p>
                                </div>
                                {/* Status */}
                                <div className="col-span-2">
                                  {task.status && (
                                    <span className="inline-flex items-center gap-1.5 text-xs text-slate-300">
                                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusColor(task.status)}`} />
                                      <span className="truncate">{task.status}</span>
                                    </span>
                                  )}
                                </div>
                                {/* DRI (assignees) */}
                                <div className="col-span-3">
                                  {task.assignees.length > 0 ? (
                                    <span className="flex items-center gap-1 text-xs text-slate-300">
                                      <Users className="h-3 w-3 text-slate-500 flex-shrink-0" />
                                      <span className="truncate">{task.assignees.map((a) => a.name).join(', ')}</span>
                                    </span>
                                  ) : (
                                    <span className="text-xs text-slate-600 italic">Unassigned</span>
                                  )}
                                </div>
                                {/* Due date */}
                                <div className="col-span-2">
                                  {displayDl ? (
                                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${displayDl.color}`}>
                                      {displayDl.text}
                                    </span>
                                  ) : (
                                    <span className="text-[11px] text-slate-600">No date</span>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                      </div>
                    </div>
                  )}
                  {isExpanded && boardTasks.length === 0 && (
                    <div className="border-t border-slate-700/50 px-5 py-4 text-sm text-slate-500 text-center">
                      No tasks in this board
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
