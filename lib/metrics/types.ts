export type FunnelType = 'call' | 'webinar' | 'challenge'

export type MetricType = 'count' | 'currency' | 'percent' | 'ratio'

export interface CanonicalMetric {
  key: string
  display_name: string
  type: MetricType
  description: string
  aliases: string[]
  formula?: string
  is_derived?: boolean
  required_metrics?: string[]
}

export interface MappingProposal {
  raw_column: string
  tab: string
  canonical_metric: string
  confidence: 'direct' | 'derived' | 'estimated'
  notes: string
}

export interface DerivedMetricProposal {
  canonical_metric: string
  formula: string
  required_metrics: string[]
  notes: string
}

export interface AmbiguousMapping {
  raw_column: string
  tab: string
  possible_mappings: string[]
  question: string
}

export interface MapperResult {
  mappings: MappingProposal[]
  derived_metrics: DerivedMetricProposal[]
  missing_metrics: string[]
  missing_notes: string
  ambiguities: AmbiguousMapping[]
}

export interface SheetTabData {
  name: string
  headers: string[]
  sampleRows: string[][]
}

export interface Client {
  id: string
  slug: string
  name: string
  funnel_type: FunnelType
  funnel_config: Record<string, unknown>
  created_at: string
}

export interface DataSource {
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

export interface MetricSnapshot {
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

export interface ClientEvent {
  id: string
  client_id: string
  event_name: string
  event_date: string
  event_type: 'launch' | 'challenge' | 'webinar' | 'sale' | null
  notes: string | null
}
