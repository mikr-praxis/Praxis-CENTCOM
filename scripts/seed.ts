import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const USER_ID = process.env.CLERK_USER_ID || 'YOUR_CLERK_USER_ID'

async function seed() {
  console.log('Seeding database...')

  const { error: budgetError } = await supabase.from('budget_items').insert([
    { name: 'Claude', plan: 'Monthly', cost: 100, expense_type: 'Personal', card: 'Amex', user_id: USER_ID },
    { name: 'Vercel', plan: 'Free Tier - Testing', cost: 0, expense_type: 'Business', card: '', user_id: USER_ID },
    { name: 'Supabase', plan: 'Free Tier - Testing', cost: 0, expense_type: 'Business', card: '', user_id: USER_ID },
    { name: 'Cloudflare', plan: 'Free Tier - Testing', cost: 0, expense_type: 'Business', card: '', user_id: USER_ID },
    { name: 'Gemini', plan: 'Monthly', cost: 8, expense_type: 'Personal', card: 'Amex', user_id: USER_ID },
    { name: 'Upstash', plan: 'Free Tier - Testing', cost: 0, expense_type: 'Business', card: '', user_id: USER_ID },
    { name: 'Clerk', plan: 'Free Tier - Testing', cost: 0, expense_type: 'Business', card: '', user_id: USER_ID },
    { name: 'PostHog', plan: 'Free Tier - Testing', cost: 0, expense_type: 'Business', card: '', user_id: USER_ID },
    { name: 'Sentry', plan: 'Free Tier - Testing', cost: 0, expense_type: 'Business', card: '', user_id: USER_ID },
    { name: 'Github', plan: 'Free Tier - Testing', cost: 0, expense_type: 'Business', card: '', user_id: USER_ID },
  ])
  if (budgetError) console.error('Budget seed error:', budgetError)
  else console.log('Budget items seeded.')

  const { error: workflowError } = await supabase.from('workflows').insert([
    { name: 'Weekly Standup Summary', schedule: 'Mon 9:00 AM', status: 'active', platform: 'Slack', user_id: USER_ID },
    { name: 'Sprint Report Generator', schedule: 'Fri 4:00 PM', status: 'active', platform: 'Email', user_id: USER_ID },
    { name: 'Budget Alert Monitor', schedule: 'Daily 8:00 AM', status: 'active', platform: 'Slack', user_id: USER_ID },
    { name: 'Overdue Task Escalation', schedule: 'Tue/Thu 10:00 AM', status: 'paused', platform: 'Slack', user_id: USER_ID },
  ])
  if (workflowError) console.error('Workflow seed error:', workflowError)
  else console.log('Workflows seeded.')

  const { error: taskError } = await supabase.from('tasks').insert([
    { title: 'Set up Cloudflare DNS proxy', priority: 'high', status: 'todo', assignee: 'Mikr', due_date: '2026-04-07', tag: 'infra', user_id: USER_ID },
    { title: 'Configure PostHog events', priority: 'medium', status: 'inprogress', assignee: 'Mikr', due_date: '2026-04-10', tag: 'analytics', user_id: USER_ID },
    { title: 'Test Clerk auth flow E2E', priority: 'high', status: 'review', assignee: 'Mikr', due_date: '2026-04-05', tag: 'auth', user_id: USER_ID },
    { title: 'Write agent prompt templates', priority: 'medium', status: 'done', assignee: 'Mikr', due_date: '2026-04-03', tag: 'ai', user_id: USER_ID },
    { title: 'Design budget dashboard view', priority: 'low', status: 'todo', assignee: 'Mikr', due_date: '2026-04-14', tag: 'design', user_id: USER_ID },
  ])
  if (taskError) console.error('Task seed error:', taskError)
  else console.log('Tasks seeded.')

  const { error: eventError } = await supabase.from('events').insert([
    { title: 'Team Standup', event_date: '2026-04-06', event_time: '09:00', duration: '30min', event_type: 'internal', attendees: 5, user_id: USER_ID },
    { title: 'Client Onboarding: Krista', event_date: '2026-04-07', event_time: '14:00', duration: '1hr', event_type: 'client', attendees: 3, user_id: USER_ID },
    { title: 'Sprint Review', event_date: '2026-04-10', event_time: '16:00', duration: '45min', event_type: 'internal', attendees: 4, user_id: USER_ID },
  ])
  if (eventError) console.error('Event seed error:', eventError)
  else console.log('Events seeded.')

  const { error: projectError } = await supabase.from('projects').insert([
    { name: 'Dashboard', description: 'Main KPI overview and activity feed', status: 'complete', category: 'core', progress: 100, priority: 'high', user_id: USER_ID },
    { name: 'Tasks / Kanban', description: 'Task management with drag-and-drop Kanban board', status: 'complete', category: 'core', progress: 100, priority: 'high', user_id: USER_ID },
    { name: 'Budget Tracking', description: 'SaaS stack cost tracking and expense management', status: 'complete', category: 'core', progress: 100, priority: 'high', user_id: USER_ID },
    { name: 'Slack Comms', description: 'Slack message monitoring and channel management', status: 'complete', category: 'core', progress: 100, priority: 'high', user_id: USER_ID },
    { name: 'Events / Calendar', description: 'Event tracking with Google Calendar sync', status: 'in-progress', category: 'core', progress: 70, priority: 'high', target_date: '2026-04-21', user_id: USER_ID },
    { name: 'AI Agents', description: 'Claude-powered agent execution and log review', status: 'in-progress', category: 'ai', progress: 40, priority: 'high', target_date: '2026-04-28', user_id: USER_ID },
    { name: 'Monday.com Integration', description: 'Sync tasks and boards from Monday.com', status: 'planned', category: 'integration', progress: 0, priority: 'medium', target_date: '2026-05-05', user_id: USER_ID },
    { name: 'ActiveCampaign Integration', description: 'CRM contact and automation sync', status: 'planned', category: 'integration', progress: 0, priority: 'medium', target_date: '2026-05-12', user_id: USER_ID },
    { name: 'HubSpot Integration', description: 'Marketing and sales pipeline sync', status: 'planned', category: 'integration', progress: 0, priority: 'low', target_date: '2026-05-19', user_id: USER_ID },
    { name: 'Memory System', description: 'Claude Code persistent memory for project context', status: 'complete', category: 'infrastructure', progress: 100, priority: 'medium', target_date: '2026-04-14', user_id: USER_ID },
    { name: 'Project Roadmap', description: 'Module progress tracking and roadmap visualization', status: 'in-progress', category: 'core', progress: 80, priority: 'medium', target_date: '2026-04-14', user_id: USER_ID },
  ])
  if (projectError) console.error('Project seed error:', projectError)
  else console.log('Projects seeded.')

  console.log('Seed complete.')
}

seed()
