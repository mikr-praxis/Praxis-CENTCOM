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

// Client Performance Dashboard types
export type Client = {
  id: string
  slug: string
  name: string
  funnel_type: 'call' | 'webinar' | 'challenge'
  funnel_config: Record<string, unknown>
  created_at: string
}

export type DataSourceRow = {
  id: string
  client_id: string
  source_type: 'google_sheet' | 'csv' | 'manual'
  source_url: string | null
  sheet_name: string | null
  last_synced_at: string | null
  column_mapping: Record<string, unknown>
  mapping_status: 'pending' | 'approved' | 'active'
  created_at: string
}

export type MetricSnapshotRow = {
  id: string
  client_id: string
  metric_key: string
  metric_value: number | null
  period_date: string
  period_type: 'day' | 'week' | 'month'
  confidence: 'direct' | 'derived' | 'estimated'
  derivation_notes: string | null
  source_id: string | null
  created_at: string
}

export type ClientEventRow = {
  id: string
  client_id: string
  event_name: string
  event_date: string
  event_type: 'launch' | 'challenge' | 'webinar' | 'sale' | null
  notes: string | null
}

export type Database = {
  public: {
    Tables: {
      clients: {
        Row: Client
        Insert: Partial<Client> & Pick<Client, 'slug' | 'name' | 'funnel_type'>
        Update: Partial<Client>
        Relationships: []
      }
      data_sources: {
        Row: DataSourceRow
        Insert: Partial<DataSourceRow> & Pick<DataSourceRow, 'client_id' | 'source_type'>
        Update: Partial<DataSourceRow>
        Relationships: []
      }
      metric_snapshots: {
        Row: MetricSnapshotRow
        Insert: Partial<MetricSnapshotRow> & Pick<MetricSnapshotRow, 'client_id' | 'metric_key' | 'period_date'>
        Update: Partial<MetricSnapshotRow>
        Relationships: []
      }
      client_events: {
        Row: ClientEventRow
        Insert: Partial<ClientEventRow> & Pick<ClientEventRow, 'client_id' | 'event_name' | 'event_date'>
        Update: Partial<ClientEventRow>
        Relationships: []
      }
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
    }
    Views: Record<string, never>
    Functions: Record<string, never>
  }
}
