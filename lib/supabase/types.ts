export type Task = {
  id: string
  title: string
  priority: 'high' | 'medium' | 'low'
  status: 'todo' | 'inprogress' | 'review' | 'done'
  assignee: string | null
  due_date: string | null
  tag: string | null
  assignee_id: string | null
  tags: string[]
  group_id: string | null
  user_id: string
  created_at: string
  updated_at: string
}

export type BudgetItem = {
  id: string
  name: string
  plan: string
  cost: number
  expense_type: 'Personal' | 'Business'
  card: string | null
  tags: string[]
  group_id: string | null
  user_id: string
  created_at: string
}

export type Event = {
  id: string
  title: string
  event_date: string
  event_time: string | null
  duration: string | null
  event_type: string
  attendees: number
  tags: string[]
  assignee_id: string | null
  group_id: string | null
  user_id: string
  created_at: string
}

export type Workflow = {
  id: string
  name: string
  schedule: string | null
  status: 'active' | 'paused'
  platform: string
  last_run: string | null
  run_count: number
  tags: string[]
  assignee_id: string | null
  group_id: string | null
  user_id: string
  created_at: string
}

export type AgentLog = {
  id: string
  agent_id: string
  agent_name: string | null
  output: string | null
  approved: boolean
  user_id: string
  created_at: string
}

export type MessageLog = {
  id: string
  channel_id: string
  channel_name: string | null
  message_text: string
  slack_ts: string | null
  direction: 'inbound' | 'outbound'
  workflow_id: string | null
  user_id: string
  created_at: string
}

export type ProjectStage = 'lead' | 'discovery' | 'proposal' | 'onboarded' | 'building' | 'qa' | 'deployed'

export type Project = {
  id: string
  name: string
  client_tag: string | null
  slack_tag: string | null
  slack_channel_id: string | null
  stage: ProjectStage
  priority: 'high' | 'medium' | 'low'
  owner_id: string | null
  description: string | null
  deadline: string | null
  notes: string | null
  user_id: string
  created_at: string
  updated_at: string
}

export const PROJECT_STAGES: { key: ProjectStage; label: string; color: string }[] = [
  { key: 'lead', label: 'Lead', color: 'slate' },
  { key: 'discovery', label: 'Discovery', color: 'purple' },
  { key: 'proposal', label: 'Proposal', color: 'blue' },
  { key: 'onboarded', label: 'Onboarded', color: 'cyan' },
  { key: 'building', label: 'Building', color: 'amber' },
  { key: 'qa', label: 'QA', color: 'orange' },
  { key: 'deployed', label: 'Deployed', color: 'green' },
]

export type GoogleToken = {
  id: string
  user_id: string
  email: string
  access_token: string
  refresh_token: string
  token_expiry: string
  created_at: string
  updated_at: string
}

export type Database = {
  public: {
    Tables: {
      tasks: {
        Row: Task
        Insert: Partial<Task> & Pick<Task, 'title' | 'user_id'>
        Update: Partial<Task>
        Relationships: []
      }
      budget_items: {
        Row: BudgetItem
        Insert: Partial<BudgetItem> & Pick<BudgetItem, 'name' | 'plan' | 'user_id'>
        Update: Partial<BudgetItem>
        Relationships: []
      }
      events: {
        Row: Event
        Insert: Partial<Event> & Pick<Event, 'title' | 'event_date' | 'user_id'>
        Update: Partial<Event>
        Relationships: []
      }
      workflows: {
        Row: Workflow
        Insert: Partial<Workflow> & Pick<Workflow, 'name' | 'user_id'>
        Update: Partial<Workflow>
        Relationships: []
      }
      agent_logs: {
        Row: AgentLog
        Insert: Partial<AgentLog> & Pick<AgentLog, 'agent_id' | 'user_id'>
        Update: Partial<AgentLog>
        Relationships: []
      }
      message_logs: {
        Row: MessageLog
        Insert: Partial<MessageLog> & Pick<MessageLog, 'channel_id' | 'message_text' | 'user_id'>
        Update: Partial<MessageLog>
        Relationships: []
      }
      projects: {
        Row: Project
        Insert: Partial<Project> & Pick<Project, 'name' | 'user_id'>
        Update: Partial<Project>
        Relationships: []
      }
      google_tokens: {
        Row: GoogleToken
        Insert: Partial<GoogleToken> & Pick<GoogleToken, 'user_id' | 'email' | 'access_token' | 'refresh_token' | 'token_expiry'>
        Update: Partial<GoogleToken>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
  }
}
