import type { CanonicalMetric } from './types'

export const WEBINAR_FUNNEL_METRICS: CanonicalMetric[] = [
  { key: 'registrations', display_name: 'Registrations', type: 'count', description: 'Total webinar registrations.', aliases: ['sign-ups', 'signups', 'reg', 'registered', 'form fills', 'total registered'] },
  { key: 'live_attendees', display_name: 'Live Attendees', type: 'count', description: 'Attended the live broadcast.', aliases: ['live', 'attended live', 'live views', 'peak live viewers'] },
  { key: 'replay_viewers', display_name: 'Replay Viewers', type: 'count', description: 'Watched the replay.', aliases: ['replay', 'replay views', 'replay count', 'watched replay'] },
  { key: 'total_attendees', display_name: 'Total Attendees', type: 'count', description: 'Live + replay viewers.', aliases: ['total views', 'all attendees'], formula: 'live_attendees + replay_viewers', is_derived: true, required_metrics: ['live_attendees', 'replay_viewers'] },
  { key: 'attendance_rate', display_name: 'Attendance Rate', type: 'percent', description: 'Live attendees / registrations.', aliases: ['show rate', 'live rate'], formula: 'live_attendees / registrations', is_derived: true, required_metrics: ['live_attendees', 'registrations'] },
  { key: 'offer_clicks', display_name: 'Offer Clicks', type: 'count', description: 'CTA/offer button clicks.', aliases: ['CTA', 'offer button', 'buy now clicks', 'checkout', 'sales page clicks'] },
  { key: 'offer_click_rate', display_name: 'Offer Click Rate', type: 'percent', description: 'Offer clicks / total attendees.', aliases: ['cta rate', 'click rate'], formula: 'offer_clicks / total_attendees', is_derived: true, required_metrics: ['offer_clicks', 'total_attendees'] },
  { key: 'applications', display_name: 'Applications', type: 'count', description: 'Application submissions (if app model).', aliases: ['apps', 'applied', 'app submissions'] },
  { key: 'calls_booked', display_name: 'Calls Booked', type: 'count', description: 'Scheduled calls from webinar.', aliases: ['appointments', 'bookings', 'scheduled'] },
  { key: 'closes', display_name: 'Closes / Sales', type: 'count', description: 'Total sales attributed to the webinar.', aliases: ['sales', 'new clients', 'enrolled', 'paid'] },
  { key: 'cash_collected', display_name: 'Cash Collected', type: 'currency', description: 'Actual cash received.', aliases: ['cash', 'revenue collected', 'collected'] },
  { key: 'revenue_per_registrant', display_name: 'Revenue per Registrant', type: 'currency', description: 'Cash collected / registrations.', aliases: ['RPR', 'rev/reg'], formula: 'cash_collected / registrations', is_derived: true, required_metrics: ['cash_collected', 'registrations'] },
  { key: 'average_order_value', display_name: 'AOV', type: 'currency', description: 'Cash collected / closes.', aliases: ['aov', 'avg deal size'], formula: 'cash_collected / closes', is_derived: true, required_metrics: ['cash_collected', 'closes'] },
  { key: 'ad_spend', display_name: 'Ad Spend', type: 'currency', description: 'Paid media spend driving to webinar.', aliases: ['spend', 'media spend'] },
  { key: 'cost_per_registrant', display_name: 'Cost per Registrant', type: 'currency', description: 'Ad spend / registrations.', aliases: ['cpr', 'cost per reg'], formula: 'ad_spend / registrations', is_derived: true, required_metrics: ['ad_spend', 'registrations'] },
  { key: 'roas', display_name: 'ROAS', type: 'ratio', description: 'Cash collected / ad spend.', aliases: ['return on ad spend'], formula: 'cash_collected / ad_spend', is_derived: true, required_metrics: ['cash_collected', 'ad_spend'] },
]

export const WEBINAR_FUNNEL_STAGES = [
  { label: 'Registrations', metricKey: 'registrations' },
  { label: 'Attendees', metricKey: 'total_attendees' },
  { label: 'Offer Clicks', metricKey: 'offer_clicks' },
  { label: 'Closes', metricKey: 'closes' },
]

export const WEBINAR_FUNNEL_BENCHMARKS: Record<string, { weak: number; strong: number }> = {
  attendance_rate: { weak: 0.2, strong: 0.4 },
  offer_click_rate: { weak: 0.05, strong: 0.15 },
  revenue_per_registrant: { weak: 10, strong: 50 },
  roas: { weak: 1.5, strong: 3 },
}

export const WEBINAR_FUNNEL_KPI_KEYS = [
  'registrations', 'live_attendees', 'offer_clicks', 'closes', 'cash_collected', 'attendance_rate',
]
