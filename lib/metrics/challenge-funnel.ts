import type { CanonicalMetric } from './types'

export const CHALLENGE_FUNNEL_METRICS: CanonicalMetric[] = [
  { key: 'registrations', display_name: 'Registrations', type: 'count', description: 'Total challenge registrations.', aliases: ['sign-ups', 'challenge registrants', 'total registered', 'reg count'] },
  { key: 'day1_live', display_name: 'Day 1 Live', type: 'count', description: 'Day 1 live attendees.', aliases: ['Day 1 attendees', 'D1 live', 'Day 1 count'] },
  { key: 'day2_live', display_name: 'Day 2 Live', type: 'count', description: 'Day 2 live attendees.', aliases: ['Day 2 attendees', 'D2 live'] },
  { key: 'day3_live', display_name: 'Day 3 (Pitch Day) Live', type: 'count', description: 'Pitch day live attendees.', aliases: ['pitch day attendance', 'day 3 live', 'closing day'] },
  { key: 'day1_attendance_rate', display_name: 'Day 1 Attendance Rate', type: 'percent', description: 'Day 1 live / registrations.', aliases: [], formula: 'day1_live / registrations', is_derived: true, required_metrics: ['day1_live', 'registrations'] },
  { key: 'day3_attendance_rate', display_name: 'Day 3 Attendance Rate', type: 'percent', description: 'Day 3 live / registrations.', aliases: [], formula: 'day3_live / registrations', is_derived: true, required_metrics: ['day3_live', 'registrations'] },
  { key: 'retention_day1_to_day3', display_name: 'Retention D1→D3', type: 'percent', description: 'Day 3 live / Day 1 live.', aliases: ['retention', 'D1 to D3', 'completion rate'], formula: 'day3_live / day1_live', is_derived: true, required_metrics: ['day3_live', 'day1_live'] },
  { key: 'offer_clicks', display_name: 'Offer Clicks', type: 'count', description: 'CTA clicks or application submissions.', aliases: ['application', 'apply now', 'enroll', 'checkout', 'buy button'] },
  { key: 'offer_click_rate', display_name: 'Offer Click Rate', type: 'percent', description: 'Offer clicks / Day 3 total.', aliases: [], formula: 'offer_clicks / day3_live', is_derived: true, required_metrics: ['offer_clicks', 'day3_live'] },
  { key: 'calls_booked', display_name: 'Calls Booked', type: 'count', description: 'Calls booked from pitch.', aliases: ['appointments', 'bookings'] },
  { key: 'calls_showed', display_name: 'Calls Showed', type: 'count', description: 'Calls where prospect showed.', aliases: ['shows', 'attended'] },
  { key: 'show_rate', display_name: 'Show Rate', type: 'percent', description: 'Calls showed / calls booked.', aliases: [], formula: 'calls_showed / calls_booked', is_derived: true, required_metrics: ['calls_showed', 'calls_booked'] },
  { key: 'closes', display_name: 'Closes', type: 'count', description: 'Total sales.', aliases: ['sales', 'new clients', 'enrolled'] },
  { key: 'close_rate', display_name: 'Close Rate', type: 'percent', description: 'Closes / calls showed.', aliases: [], formula: 'closes / calls_showed', is_derived: true, required_metrics: ['closes', 'calls_showed'] },
  { key: 'cash_collected', display_name: 'Cash Collected', type: 'currency', description: 'Actual cash received.', aliases: ['cash', 'revenue collected'] },
  { key: 'average_order_value', display_name: 'AOV', type: 'currency', description: 'Cash / closes.', aliases: ['aov'], formula: 'cash_collected / closes', is_derived: true, required_metrics: ['cash_collected', 'closes'] },
  { key: 'revenue_per_registrant', display_name: 'Revenue per Registrant', type: 'currency', description: 'Cash / registrations.', aliases: ['RPR'], formula: 'cash_collected / registrations', is_derived: true, required_metrics: ['cash_collected', 'registrations'] },
  { key: 'ad_spend', display_name: 'Ad Spend', type: 'currency', description: 'Paid media spend.', aliases: ['spend', 'media spend'] },
  { key: 'roas', display_name: 'ROAS', type: 'ratio', description: 'Cash / ad spend.', aliases: [], formula: 'cash_collected / ad_spend', is_derived: true, required_metrics: ['cash_collected', 'ad_spend'] },
]

export const CHALLENGE_FUNNEL_STAGES = [
  { label: 'Registrations', metricKey: 'registrations' },
  { label: 'Day 1 Live', metricKey: 'day1_live' },
  { label: 'Day 3 Live', metricKey: 'day3_live' },
  { label: 'Calls Booked', metricKey: 'calls_booked' },
  { label: 'Closes', metricKey: 'closes' },
]

export const CHALLENGE_FUNNEL_BENCHMARKS: Record<string, { weak: number; strong: number }> = {
  day1_attendance_rate: { weak: 0.2, strong: 0.35 },
  day3_attendance_rate: { weak: 0.1, strong: 0.2 },
  retention_day1_to_day3: { weak: 0.4, strong: 0.65 },
  offer_click_rate: { weak: 0.1, strong: 0.25 },
  revenue_per_registrant: { weak: 20, strong: 100 },
}

export const CHALLENGE_FUNNEL_KPI_KEYS = [
  'registrations', 'day3_live', 'calls_booked', 'closes', 'cash_collected', 'day3_attendance_rate',
]
