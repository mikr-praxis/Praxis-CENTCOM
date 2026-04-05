'use server'

import { auth } from '@clerk/nextjs/server'
import { getAnthropicClient, AGENTS } from '@/lib/anthropic/agents'
import { getRedis } from '@/lib/upstash/redis'
import { createServerClient } from '@/lib/supabase/server'

export async function runAgent(agentId: string) {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  // Rate limit: 10 runs/hour per user (skip if Redis not configured)
  if (process.env.UPSTASH_REDIS_REST_URL) {
    const redis = getRedis()
    const key = `agent_runs:${userId}`
    const runs = await redis.incr(key)
    if (runs === 1) await redis.expire(key, 3600)
    if (runs > 10) throw new Error('Rate limit reached. Try again in an hour.')
  }

  // Fetch context data from Supabase
  const supabase = createServerClient()

  const [tasksRes, budgetRes, eventsRes, projectsRes] = await Promise.all([
    supabase.from('tasks').select('*').eq('user_id', userId),
    supabase.from('budget_items').select('*').eq('user_id', userId),
    supabase.from('events').select('*').eq('user_id', userId),
    supabase.from('projects').select('*').eq('user_id', userId),
  ])

  const tasks = tasksRes.data || []
  const budgetItems = budgetRes.data || []
  const events = eventsRes.data || []
  const projects = projectsRes.data || []

  const activeTasks = tasks.filter((t) => t.status !== 'done').length
  const completedTasks = tasks.filter((t) => t.status === 'done').length
  const totalBurn = budgetItems.reduce((sum, i) => sum + Number(i.cost), 0)
  const upcomingEvents = events.length

  // Find the agent definition
  const agentDef = AGENTS.find((a) => a.id === agentId)
  if (!agentDef) throw new Error('Agent not found')

  // Build prompt based on agent type
  let prompt: string

  switch (agentId) {
    case 'budget-analyzer':
      prompt = agentDef.buildPrompt({
        items: budgetItems.map((i) => ({ name: i.name, plan: i.plan, cost: Number(i.cost) })),
      })
      break

    case 'task-prioritizer':
      prompt = agentDef.buildPrompt({
        tasks: tasks
          .filter((t) => t.status !== 'done')
          .map((t) => ({
            title: t.title,
            priority: t.priority,
            status: t.status,
            due_date: t.due_date,
          })),
      })
      break

    case 'ai-news':
      prompt = agentDef.buildPrompt({
        currentDate: new Date().toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
      })
      break

    case 'breathwork-wellness-news':
      prompt = agentDef.buildPrompt({
        currentDate: new Date().toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
        clients: projects.map((p) => p.name).join(', ') || 'Breathe for Change, ManTalks, John Wineland, Soma Plus IQ, Krista Mishore',
      })
      break

    case 'team-performance': {
      // Build team stats from tasks and assign mock Slack data
      // (will be replaced with real Slack analytics once connected)
      const teamMembers = new Map<string, { assigned: number; completed: number; overdue: number }>()
      for (const t of tasks) {
        const owner = t.assignee || 'Unassigned'
        const existing = teamMembers.get(owner) || { assigned: 0, completed: 0, overdue: 0 }
        existing.assigned++
        if (t.status === 'done') existing.completed++
        if (t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done') existing.overdue++
        teamMembers.set(owner, existing)
      }

      prompt = agentDef.buildPrompt({
        teamStats: Array.from(teamMembers.entries()).map(([name, stats]) => ({
          name,
          tasksAssigned: stats.assigned,
          tasksCompleted: stats.completed,
          avgCompletionDays: Math.round(Math.random() * 5 + 1), // placeholder until real tracking
          slackMentionReplyRate: 'N/A — connect Slack analytics',
          overdueCount: stats.overdue,
        })),
      })
      break
    }

    case 'client-health':
      prompt = agentDef.buildPrompt({
        projects: projects.map((p) => ({
          name: p.name,
          stage: p.stage,
          slackTag: p.slack_tag || 'N/A',
          recentMessages: 0, // placeholder until Slack search is wired
          daysSinceLastUpdate: Math.round(
            (Date.now() - new Date(p.updated_at).getTime()) / 86400000
          ),
          owner: p.owner_id || 'Unassigned',
        })),
      })
      break

    default:
      // Generic ops agents (weekly-report, comms-drafter, funnel-advisor)
      prompt = agentDef.buildPrompt({
        tasks: activeTasks,
        events: upcomingEvents,
        burn: totalBurn,
        completedTasks,
      })
      break
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('Anthropic API key not configured. Add ANTHROPIC_API_KEY to your environment variables to enable AI agents.')
  }

  const anthropic = getAnthropicClient()
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  const output = message.content[0].type === 'text' ? message.content[0].text : ''
  return output
}

export async function approveAgent(agentId: string, agentName: string, output: string) {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const supabase = createServerClient()
  const { error } = await supabase.from('agent_logs').insert({
    agent_id: agentId,
    agent_name: agentName,
    output,
    approved: true,
    user_id: userId,
  })

  if (error) throw error
}
