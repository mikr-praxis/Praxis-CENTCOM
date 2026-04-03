'use server'

import { auth } from '@clerk/nextjs/server'
import { anthropic, AGENTS } from '@/lib/anthropic/agents'
import { redis } from '@/lib/upstash/redis'
import { createServerClient } from '@/lib/supabase/server'

export async function runAgent(agentId: string) {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  // Rate limit: 10 runs/hour per user
  const key = `agent_runs:${userId}`
  const runs = await redis.incr(key)
  if (runs === 1) await redis.expire(key, 3600)
  if (runs > 10) throw new Error('Rate limit reached. Try again in an hour.')

  // Fetch context data from Supabase
  const supabase = createServerClient()

  const [tasksRes, budgetRes, eventsRes] = await Promise.all([
    supabase.from('tasks').select('*').eq('user_id', userId),
    supabase.from('budget_items').select('*').eq('user_id', userId),
    supabase.from('events').select('*').eq('user_id', userId),
  ])

  const tasks = tasksRes.data || []
  const budgetItems = budgetRes.data || []
  const events = eventsRes.data || []

  const activeTasks = tasks.filter((t) => t.status !== 'done').length
  const completedTasks = tasks.filter((t) => t.status === 'done').length
  const totalBurn = budgetItems.reduce((sum, i) => sum + Number(i.cost), 0)
  const upcomingEvents = events.length

  // Find the agent definition
  const agentDef = AGENTS.find((a) => a.id === agentId)
  if (!agentDef) throw new Error('Agent not found')

  // Build prompt based on agent type
  let prompt: string
  if (agentId === 'budget-analyzer') {
    prompt = agentDef.buildPrompt({
      items: budgetItems.map((i) => ({ name: i.name, plan: i.plan, cost: Number(i.cost) })),
    } as any)
  } else if (agentId === 'task-prioritizer') {
    prompt = agentDef.buildPrompt({
      tasks: tasks.filter((t) => t.status !== 'done').map((t) => ({
        title: t.title,
        priority: t.priority,
        status: t.status,
        due_date: t.due_date,
      })),
    } as any)
  } else {
    prompt = agentDef.buildPrompt({
      tasks: activeTasks,
      events: upcomingEvents,
      burn: totalBurn,
      completedTasks,
    } as any)
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('Anthropic API key not configured. Add ANTHROPIC_API_KEY to your environment variables to enable AI agents.')
  }

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
