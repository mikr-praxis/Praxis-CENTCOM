'use client'

import { useState, useEffect, useCallback, useTransition } from 'react'
import Link from 'next/link'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import {
  ArrowLeft,
  ChevronRight,
  RefreshCw,
  Hash,
  MessageSquare,
  CheckSquare,
  Calendar,
  DollarSign,
  User,
  Clock,
  AlertTriangle,
} from 'lucide-react'
import { advanceProject, updateProjectStage } from '@/actions/projects'
import { PROJECT_STAGES } from '@/lib/supabase/types'
import type { Project, ProjectStage } from '@/lib/supabase/types'
import type { SlackMessage } from '@/lib/slack'
import { formatSlackTs, formatSlackText } from '@/lib/slack'
import { stageColors, stageBadgeVariant } from '@/lib/styles/colors'

export function ProjectDetailClient({ project }: { project: Project }) {
  const [messages, setMessages] = useState<SlackMessage[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [messageError, setMessageError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const fetchMessages = useCallback(async () => {
    if (!project.slack_tag && !project.slack_channel_id) return
    setLoadingMessages(true)
    setMessageError(null)
    try {
      const params = new URLSearchParams()
      if (project.slack_tag) params.set('tag', project.slack_tag)
      if (project.slack_channel_id) params.set('channel', project.slack_channel_id)
      params.set('limit', '25')

      const res = await fetch(`/api/slack/project-messages?${params}`)
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to fetch messages')
      }
      const data = await res.json()
      setMessages(data.messages)
    } catch (err) {
      setMessageError(err instanceof Error ? err.message : 'Failed to load messages')
    } finally {
      setLoadingMessages(false)
    }
  }, [project.slack_tag, project.slack_channel_id])

  useEffect(() => {
    fetchMessages()
  }, [fetchMessages])

  const handleAdvance = () => {
    if (project.stage === 'deployed') return
    startTransition(async () => {
      await advanceProject(project.id)
      window.location.reload()
    })
  }

  const handleStageChange = (stage: ProjectStage) => {
    startTransition(async () => {
      await updateProjectStage(project.id, stage)
      window.location.reload()
    })
  }

  const currentStageIndex = PROJECT_STAGES.findIndex((s) => s.key === project.stage)

  // Categorize messages into updates, roadblocks, deadlines
  const roadblocks = messages.filter(
    (m) =>
      m.text.toLowerCase().includes('blocked') ||
      m.text.toLowerCase().includes('blocker') ||
      m.text.toLowerCase().includes('stuck') ||
      m.text.toLowerCase().includes('issue') ||
      m.text.toLowerCase().includes('problem') ||
      m.text.toLowerCase().includes('roadblock')
  )
  const deadlineMessages = messages.filter(
    (m) =>
      m.text.toLowerCase().includes('deadline') ||
      m.text.toLowerCase().includes('due') ||
      m.text.toLowerCase().includes('by end of') ||
      m.text.toLowerCase().includes('eod') ||
      m.text.toLowerCase().includes('eow')
  )
  const updates = messages.filter(
    (m) => !roadblocks.includes(m) && !deadlineMessages.includes(m)
  )

  return (
    <div className="space-y-6">
      {/* Back + header */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/projects"
            className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200 transition-colors mb-2"
          >
            <ArrowLeft className="h-4 w-4" />
            All Projects
          </Link>
          <h1 className="text-2xl font-bold text-slate-100">{project.name}</h1>
          {project.description && (
            <p className="text-sm text-slate-400 mt-1">{project.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={stageBadgeVariant[project.stage]}>
            {PROJECT_STAGES.find((s) => s.key === project.stage)?.label}
          </Badge>
          {project.stage !== 'deployed' && (
            <Button size="sm" onClick={handleAdvance} disabled={isPending}>
              <ChevronRight className="h-4 w-4 mr-1" />
              {isPending ? 'Moving...' : 'Advance'}
            </Button>
          )}
        </div>
      </div>

      {/* Pipeline progress bar */}
      <div className="flex items-center gap-1">
        {PROJECT_STAGES.map((stage, i) => (
          <button
            key={stage.key}
            onClick={() => handleStageChange(stage.key)}
            disabled={isPending}
            className={`flex-1 h-2 rounded-full transition-all ${
              i <= currentStageIndex
                ? stageColors[stage.key]
                : 'bg-slate-700/50'
            } hover:opacity-80`}
            title={stage.label}
          />
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-slate-600 -mt-4 px-0.5">
        {PROJECT_STAGES.map((stage) => (
          <span key={stage.key} className={project.stage === stage.key ? 'text-slate-400 font-medium' : ''}>
            {stage.label}
          </span>
        ))}
      </div>

      {/* Meta row */}
      <div className="flex flex-wrap gap-4 text-sm text-slate-400">
        {project.owner_id && (
          <span className="flex items-center gap-1.5">
            <User className="h-4 w-4 text-slate-500" />
            {project.owner_id}
          </span>
        )}
        {project.deadline && (
          <span className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4 text-slate-500" />
            {new Date(project.deadline).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
        )}
        {project.slack_tag && (
          <span className="flex items-center gap-1.5">
            <Hash className="h-4 w-4 text-slate-500" />
            {project.slack_tag}
          </span>
        )}
      </div>

      {/* Three-column insights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Roadblocks */}
        <Card className="border-red-500/20">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-400" />
              <CardTitle className="text-sm">Roadblocks</CardTitle>
              <Badge variant="red">{roadblocks.length}</Badge>
            </div>
          </CardHeader>
          {roadblocks.length === 0 ? (
            <p className="text-xs text-slate-600">No roadblocks detected</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {roadblocks.map((msg) => (
                <div key={msg.ts} className="text-xs">
                  <span className="text-slate-500">{msg.username}:</span>{' '}
                  <span className="text-red-300">{formatSlackText(msg.text).slice(0, 120)}</span>
                  <span className="text-slate-600 block">{formatSlackTs(msg.ts)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Deadlines */}
        <Card className="border-amber-500/20">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-400" />
              <CardTitle className="text-sm">Deadlines</CardTitle>
              <Badge variant="amber">{deadlineMessages.length}</Badge>
            </div>
          </CardHeader>
          {deadlineMessages.length === 0 ? (
            <p className="text-xs text-slate-600">No deadline mentions found</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {deadlineMessages.map((msg) => (
                <div key={msg.ts} className="text-xs">
                  <span className="text-slate-500">{msg.username}:</span>{' '}
                  <span className="text-amber-300">{formatSlackText(msg.text).slice(0, 120)}</span>
                  <span className="text-slate-600 block">{formatSlackTs(msg.ts)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Stats */}
        <Card className="border-blue-500/20">
          <CardHeader>
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-blue-400" />
              <CardTitle className="text-sm">Activity</CardTitle>
            </div>
          </CardHeader>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Total messages</span>
              <span className="text-sm font-medium text-slate-200">{messages.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Updates</span>
              <span className="text-sm font-medium text-slate-200">{updates.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Roadblocks</span>
              <span className="text-sm font-medium text-red-400">{roadblocks.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Deadline refs</span>
              <span className="text-sm font-medium text-amber-400">{deadlineMessages.length}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Slack message feed */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle>
                <span className="flex items-center gap-1.5">
                  <MessageSquare className="h-4 w-4 text-slate-500" />
                  Project Updates
                </span>
              </CardTitle>
              {project.slack_tag && (
                <Badge variant="default">{project.slack_tag}</Badge>
              )}
            </div>
            <button
              onClick={fetchMessages}
              disabled={loadingMessages}
              className="rounded-lg p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loadingMessages ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </CardHeader>

        {messageError && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 mb-4">
            <span className="text-xs text-red-400">{messageError}</span>
          </div>
        )}

        {!project.slack_tag && !project.slack_channel_id ? (
          <div className="text-center py-8">
            <Hash className="h-6 w-6 text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-500">
              No Slack tag configured. Add a tag like <code className="text-slate-400">[B4C]</code> to pull messages.
            </p>
          </div>
        ) : loadingMessages && messages.length === 0 ? (
          <div className="text-center py-8">
            <RefreshCw className="h-5 w-5 animate-spin text-slate-500 mx-auto mb-2" />
            <span className="text-sm text-slate-500">Scanning channels for {project.slack_tag}...</span>
          </div>
        ) : messages.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-8">
            No messages found with tag {project.slack_tag}
          </p>
        ) : (
          <div className="space-y-1 max-h-[480px] overflow-y-auto">
            {messages.map((msg) => (
              <div
                key={msg.ts}
                className="group flex items-start gap-3 rounded-lg px-3 py-2.5 hover:bg-slate-700/30 transition-colors"
              >
                <div className="h-7 w-7 rounded-md bg-slate-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-medium text-slate-300">
                    {(msg.username || msg.user).charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-200">
                      {msg.username || msg.user}
                    </span>
                    {msg.channel_name && (
                      <span className="text-xs text-slate-600">#{msg.channel_name}</span>
                    )}
                    <span className="text-xs text-slate-600">{formatSlackTs(msg.ts)}</span>
                  </div>
                  <p className="text-sm text-slate-400 mt-0.5 break-words whitespace-pre-wrap">
                    {formatSlackText(msg.text)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
