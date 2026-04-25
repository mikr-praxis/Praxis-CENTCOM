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
  drive_folder_id: string | null
  created_at: string
}

// Reporting module types (migration 015)
export type ReportRawFile = {
  id: string
  client_id: string
  drive_file_id: string
  filename: string
  mime_type: string | null
  modified_time: string | null
  last_synced_at: string | null
  columns: string[]
  rows: Record<string, unknown>[]
  row_count: number
}

export type KPIFormat = 'count' | 'currency' | 'percent' | 'ratio'
export type KPIVizType = 'card' | 'line' | 'bar' | 'pie' | 'table'

export type ReportKPI = {
  id: string
  client_id: string | null
  key: string
  display_name: string
  description: string | null
  formula: Record<string, unknown>
  format: KPIFormat
  target: number | null
  viz_type: KPIVizType
  display_order: number
  group_by_column: string | null
  group_by_source: string | null
  compare_to: 'previous_period' | 'previous_year' | null
  forecast_periods: number
  forecast_method: 'linear' | 'moving_avg' | null
  created_at: string
  updated_at: string
}

export type ReportView = {
  id: string
  client_id: string
  name: string
  timeframe: Record<string, unknown> | null
  slicers: Record<string, unknown>[]
  selected_filenames: string[]
  is_default: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export type ReportShareToken = {
  id: string
  client_id: string
  token: string
  label: string | null
  created_by: string | null
  created_at: string
  expires_at: string | null
  revoked_at: string | null
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

export type AppConfig = {
  id: string
  key: string
  value: string
  updated_by: string | null
  created_at: string
  updated_at: string
}

export type TeamCalendar = {
  id: string
  email: string
  display_name: string
  color: string
  role: string | null
  is_ops: boolean
  enabled: boolean
  source: string
  created_at: string
  updated_at: string
}

export type MondayTask = {
  id: string
  name: string
  board_id: string
  board_name: string
  group_id: string
  group_name: string
  status: string | null
  priority: string | null
  due_date: string | null
  timeline_start: string | null
  timeline_end: string | null
  assignees: unknown
  column_values: unknown
  state: string
  synced_at: string
  created_at: string
  updated_at: string
}

export type MondayWebhookLog = {
  id: string
  event_type: string
  item_id: string | null
  board_id: string | null
  payload: unknown
  processed: boolean
  created_at: string
}

export type ProjectKPI = {
  id: string
  board_id: string
  kpi_name: string
  target_value: number | null
  current_value: number | null
  unit: string
  sort_order: number
  user_id: string
  created_at: string
  updated_at: string
}

export type KPISnapshot = {
  id: string
  kpi_id: string
  value: number
  recorded_at: string
}

export type MondayColumnMapping = {
  board_id: string
  board_name: string
  status_column_id: string | null
  date_column_id: string | null
  priority_column_id: string | null
  timeline_column_id: string | null
  custom_mappings: unknown
  updated_at: string
}

export type TaskMilestone = {
  id: string
  monday_task_id: string
  title: string
  description: string | null
  status: 'pending' | 'in_progress' | 'done'
  sort_order: number
  due_date: string | null
  user_id: string
  created_at: string
  updated_at: string
}

export type BoardMilestone = {
  id: string
  board_id: string
  milestone_number: number
  title: string
  monday_task_id: string | null
  task_name: string | null
  assignee_name: string | null
  due_date: string | null
  status: 'not_started' | 'in_progress' | 'done'
  user_id: string
  created_at: string
  updated_at: string
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
      projects: {
        Row: Project
        Insert: Partial<Project> & Pick<Project, 'name' | 'user_id'>
        Update: Partial<Project>
        Relationships: []
      }
      app_config: {
        Row: AppConfig
        Insert: Partial<AppConfig> & Pick<AppConfig, 'key' | 'value'>
        Update: Partial<AppConfig>
        Relationships: []
      }
      google_tokens: {
        Row: GoogleToken
        Insert: Partial<GoogleToken> & Pick<GoogleToken, 'user_id' | 'email' | 'access_token' | 'refresh_token' | 'token_expiry'>
        Update: Partial<GoogleToken>
        Relationships: []
      }
      team_calendars: {
        Row: TeamCalendar
        Insert: Partial<TeamCalendar> & Pick<TeamCalendar, 'email' | 'display_name'>
        Update: Partial<TeamCalendar>
        Relationships: []
      }
      monday_tasks: {
        Row: MondayTask
        Insert: Partial<MondayTask> & Pick<MondayTask, 'id' | 'name' | 'board_id' | 'board_name' | 'group_id' | 'group_name'>
        Update: Partial<MondayTask>
        Relationships: []
      }
      monday_webhook_log: {
        Row: MondayWebhookLog
        Insert: Partial<MondayWebhookLog> & Pick<MondayWebhookLog, 'event_type'>
        Update: Partial<MondayWebhookLog>
        Relationships: []
      }
      monday_column_mappings: {
        Row: MondayColumnMapping
        Insert: Partial<MondayColumnMapping> & Pick<MondayColumnMapping, 'board_id' | 'board_name'>
        Update: Partial<MondayColumnMapping>
        Relationships: []
      }
      project_kpis: {
        Row: ProjectKPI
        Insert: Partial<ProjectKPI> & Pick<ProjectKPI, 'board_id' | 'kpi_name' | 'user_id'>
        Update: Partial<ProjectKPI>
        Relationships: []
      }
      kpi_snapshots: {
        Row: KPISnapshot
        Insert: Partial<KPISnapshot> & Pick<KPISnapshot, 'kpi_id' | 'value'>
        Update: Partial<KPISnapshot>
        Relationships: []
      }
      task_milestones: {
        Row: TaskMilestone
        Insert: Partial<TaskMilestone> & Pick<TaskMilestone, 'monday_task_id' | 'title' | 'user_id'>
        Update: Partial<TaskMilestone>
        Relationships: []
      }
      board_milestones: {
        Row: BoardMilestone
        Insert: Partial<BoardMilestone> & Pick<BoardMilestone, 'board_id' | 'milestone_number' | 'user_id'>
        Update: Partial<BoardMilestone>
        Relationships: []
      }
      report_raw_files: {
        Row: ReportRawFile
        Insert: Partial<ReportRawFile> & Pick<ReportRawFile, 'client_id' | 'drive_file_id' | 'filename'>
        Update: Partial<ReportRawFile>
        Relationships: []
      }
      report_kpis: {
        Row: ReportKPI
        Insert: Partial<ReportKPI> & Pick<ReportKPI, 'key' | 'display_name' | 'formula'>
        Update: Partial<ReportKPI>
        Relationships: []
      }
      report_share_tokens: {
        Row: ReportShareToken
        Insert: Partial<ReportShareToken> & Pick<ReportShareToken, 'client_id' | 'token'>
        Update: Partial<ReportShareToken>
        Relationships: []
      }
      report_views: {
        Row: ReportView
        Insert: Partial<ReportView> & Pick<ReportView, 'client_id' | 'name'>
        Update: Partial<ReportView>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
  }
}
