import Anthropic from '@anthropic-ai/sdk'

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

export const AGENTS = [
  {
    id: 'weekly-report',
    name: 'Weekly Report',
    description: 'Generate an executive summary from live KPI, task, and event data.',
    icon: 'FileText',
    buildPrompt: (data: { tasks: number; events: number; burn: number; completedTasks: number }) =>
      `You are the Praxis internal ops AI. Generate a concise executive weekly report based on:\n- Active tasks: ${data.tasks}\n- Completed tasks this week: ${data.completedTasks}\n- Events this week: ${data.events}\n- Monthly burn rate: $${data.burn}\n\nFormat as a professional but friendly internal summary with sections: Overview, Key Metrics, Highlights, and Action Items. Keep it under 300 words. Match Praxis voice: friendly, real, confident.`,
  },
  {
    id: 'budget-analyzer',
    name: 'Budget Analyzer',
    description: 'Analyze spend, identify free tier risks, and project costs at 10x scale.',
    icon: 'DollarSign',
    buildPrompt: (data: { items: Array<{ name: string; plan: string; cost: number }> }) =>
      `You are the Praxis budget analysis AI. Analyze this tech stack spend:\n${data.items.map((i) => `- ${i.name}: ${i.plan} ($${i.cost}/mo)`).join('\n')}\n\nProvide:\n1. Current monthly total and breakdown by category\n2. Free tier risk assessment (which tools might need paid plans soon)\n3. Projected costs at 10x current usage\n4. Cost optimization recommendations\n\nKeep it actionable and under 400 words. Praxis voice: direct, helpful, no fluff.`,
  },
  {
    id: 'task-prioritizer',
    name: 'Task Prioritizer',
    description: 'Re-rank tasks by urgency × impact scoring.',
    icon: 'ListOrdered',
    buildPrompt: (data: { tasks: Array<{ title: string; priority: string; status: string; due_date: string | null }> }) =>
      `You are the Praxis task prioritization AI. Re-rank these tasks by urgency × impact:\n${data.tasks.map((t) => `- "${t.title}" [${t.priority}] [${t.status}] ${t.due_date ? `due: ${t.due_date}` : 'no due date'}`).join('\n')}\n\nFor each task, provide:\n1. New priority ranking (1 = highest)\n2. Urgency score (1-5)\n3. Impact score (1-5)\n4. Brief rationale\n\nEnd with a "Focus Today" recommendation of top 3 tasks. Keep it practical.`,
  },
  {
    id: 'comms-drafter',
    name: 'Comms Drafter',
    description: 'Draft an investor/stakeholder update email from current data.',
    icon: 'Mail',
    buildPrompt: (data: { tasks: number; events: number; burn: number; completedTasks: number }) =>
      `You are the Praxis communications AI. Draft a stakeholder/investor update email based on:\n- Active tasks: ${data.tasks}\n- Completed tasks: ${data.completedTasks}\n- Upcoming events: ${data.events}\n- Monthly burn: $${data.burn}\n\nWrite a professional but warm email that:\n1. Opens with a brief positive highlight\n2. Summarizes key operational metrics\n3. Notes upcoming milestones\n4. Closes with next steps\n\nMatch the Praxis voice: friendly, confident, real. No corporate jargon. Under 300 words.`,
  },
] as const
