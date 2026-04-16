'use client'

import { CheckCircle2, XCircle, Clock, ArrowRight, BarChart3, Database, Key, FileSpreadsheet, Users, TrendingUp, RefreshCw } from 'lucide-react'
import Link from 'next/link'

interface ClientsBuildProgressProps {
  migrationRun: boolean
  sheetsApiEnabled: boolean
  anthropicKeySet: boolean
  clients: Array<{ id: string; slug: string; name: string; funnel_type: string }>
}

type StepStatus = 'done' | 'error' | 'pending'

interface MilestoneStep {
  label: string
  description: string
  status: StepStatus
  detail?: string
  action?: string
}

interface Milestone {
  id: string
  title: string
  description: string
  status: 'done' | 'in_progress' | 'blocked' | 'pending'
  steps: MilestoneStep[]
}

export function ClientsBuildProgress({
  migrationRun,
  sheetsApiEnabled,
  anthropicKeySet,
  clients,
}: ClientsBuildProgressProps) {
  const hasClients = clients.length > 0

  const milestones: Milestone[] = [
    {
      id: 'm1',
      title: 'M1: Foundation',
      description: 'Data pipeline, schema, metric mapper, dashboard UI',
      status: getMilestoneStatus([
        anthropicKeySet,
        true, // code is deployed
        migrationRun,
        sheetsApiEnabled,
      ]),
      steps: [
        {
          label: 'Dashboard code deployed',
          description: 'Routes, components, API endpoints, AI mapper',
          status: 'done',
          detail: '/dashboard/[slug], /api/ingest/*, /api/clients/*/metrics',
        },
        {
          label: 'ANTHROPIC_API_KEY in Vercel',
          description: 'Required for AI metric mapping',
          status: anthropicKeySet ? 'done' : 'error',
          detail: anthropicKeySet ? 'Set in Vercel env vars' : 'Missing — add at console.anthropic.com',
          action: anthropicKeySet ? undefined : 'Add key in Vercel → Environment Variables',
        },
        {
          label: 'Google Sheets API credentials',
          description: 'Service account email + key for reading client sheets',
          status: sheetsApiEnabled ? 'done' : 'error',
          detail: sheetsApiEnabled
            ? 'GOOGLE_SERVICE_ACCOUNT_EMAIL + KEY both set'
            : 'Enable Sheets API at console.cloud.google.com and verify env vars',
          action: sheetsApiEnabled ? undefined : 'Enable API at GCP Console → APIs & Services → Sheets API',
        },
        {
          label: 'Supabase migration',
          description: '4 tables: clients, data_sources, metric_snapshots, client_events',
          status: migrationRun ? 'done' : 'error',
          detail: migrationRun
            ? `Tables created — ${clients.length} client(s) seeded`
            : 'Run supabase/migrations/008_client_performance.sql in the SQL Editor',
          action: migrationRun ? undefined : 'Supabase Dashboard → SQL Editor → paste migration → Run',
        },
        {
          label: 'Recharts installed',
          description: 'Chart library for trend visualization',
          status: 'done',
          detail: 'recharts@^3.8.1 in package.json',
        },
      ],
    },
    {
      id: 'm2',
      title: 'M2: First Client Live',
      description: 'Mashore dashboard rendering with real data',
      status: hasClients ? 'in_progress' : 'blocked',
      steps: [
        {
          label: 'Mashore client record',
          description: 'Seeded in clients table with funnel type',
          status: hasClients ? 'done' : 'pending',
          detail: hasClients ? `${clients.length} client(s) in database` : 'Waiting on migration',
        },
        {
          label: 'Connect Mashore data source',
          description: 'Google Sheet or CSV with performance data',
          status: 'pending',
          detail: 'Share Sheet with service account, then use /dashboard/mashore → Connect Sheet',
          action: hasClients ? 'Go to /dashboard/mashore → Connect Sheet' : undefined,
        },
        {
          label: 'AI mapping approved',
          description: 'Review and approve column-to-metric mappings',
          status: 'pending',
          detail: 'Opus maps raw columns to canonical funnel metrics. You review before data imports.',
        },
        {
          label: 'Dashboard renders with data',
          description: 'KPI cards, funnel viz, trend charts populated',
          status: 'pending',
        },
      ],
    },
    {
      id: 'm3',
      title: 'M3: Executive View',
      description: 'All-client summary + other funnel types',
      status: 'pending',
      steps: [
        {
          label: '/dashboard exec summary',
          description: 'Client table with sparklines and status chips',
          status: 'pending',
        },
        {
          label: 'Webinar funnel dashboard',
          description: 'Registration → attendance → offer → close flow',
          status: 'pending',
        },
        {
          label: 'Challenge funnel dashboard',
          description: '3-day live challenge with day-by-day attendance',
          status: 'pending',
        },
      ],
    },
    {
      id: 'm4',
      title: 'M4: Automation + Polish',
      description: 'Forecasting, nightly sync, mobile UX',
      status: 'pending',
      steps: [
        {
          label: 'Forecasting engine',
          description: 'Trailing average projections with event-aware bumps',
          status: 'pending',
        },
        {
          label: 'Nightly sync cron',
          description: 'Auto-refresh Sheet data using approved mappings',
          status: 'pending',
        },
        {
          label: 'Polish',
          description: 'Loading states, mobile layout, error handling',
          status: 'pending',
        },
      ],
    },
  ]

  const completedSteps = milestones.flatMap(m => m.steps).filter(s => s.status === 'done').length
  const totalSteps = milestones.flatMap(m => m.steps).length
  const progressPct = Math.round((completedSteps / totalSteps) * 100)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Client Performance Dashboards</h1>
          <p className="text-sm text-slate-400 mt-1">Build progress — {completedSteps}/{totalSteps} steps complete</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-2xl font-bold text-amber-400">{progressPct}%</p>
            <p className="text-[10px] text-slate-500 uppercase">Overall</p>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 rounded-full transition-all duration-500"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Client quick links (if any exist) */}
      {clients.length > 0 && (
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">Active Clients</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {clients.map(client => (
              <Link
                key={client.id}
                href={`/dashboard/${client.slug}`}
                className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800 border border-zinc-700 hover:border-indigo-500/30 transition-colors"
              >
                <BarChart3 className="h-5 w-5 text-indigo-400" />
                <div>
                  <p className="text-sm font-medium text-slate-200">{client.name}</p>
                  <p className="text-xs text-slate-500">{client.funnel_type} funnel</p>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-600 ml-auto" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Milestones */}
      <div className="space-y-4">
        {milestones.map((milestone) => (
          <MilestoneCard key={milestone.id} milestone={milestone} />
        ))}
      </div>
    </div>
  )
}

function MilestoneCard({ milestone }: { milestone: Milestone }) {
  const statusConfig = {
    done: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', icon: <CheckCircle2 className="h-5 w-5 text-emerald-400" />, label: 'Complete', labelColor: 'text-emerald-400' },
    in_progress: { bg: 'bg-amber-400/10', border: 'border-amber-400/30', icon: <Clock className="h-5 w-5 text-amber-400" />, label: 'In Progress', labelColor: 'text-amber-400' },
    blocked: { bg: 'bg-red-500/10', border: 'border-red-500/30', icon: <XCircle className="h-5 w-5 text-red-400" />, label: 'Blocked', labelColor: 'text-red-400' },
    pending: { bg: 'bg-zinc-800/50', border: 'border-zinc-700', icon: <Clock className="h-5 w-5 text-slate-500" />, label: 'Upcoming', labelColor: 'text-slate-500' },
  }

  const config = statusConfig[milestone.status]

  return (
    <div className={`rounded-xl border ${config.border} ${config.bg} overflow-hidden`}>
      <div className="flex items-center gap-3 p-4">
        {config.icon}
        <div className="flex-1">
          <h3 className="text-sm font-bold text-slate-200">{milestone.title}</h3>
          <p className="text-xs text-slate-400">{milestone.description}</p>
        </div>
        <span className={`text-xs font-medium ${config.labelColor}`}>{config.label}</span>
      </div>
      <div className="border-t border-zinc-800/50 divide-y divide-zinc-800/30">
        {milestone.steps.map((step, i) => (
          <StepRow key={i} step={step} />
        ))}
      </div>
    </div>
  )
}

function StepRow({ step }: { step: MilestoneStep }) {
  const iconMap = {
    done: <CheckCircle2 className="h-4 w-4 text-emerald-400" />,
    error: <XCircle className="h-4 w-4 text-red-400" />,
    pending: <Clock className="h-4 w-4 text-slate-600" />,
  }

  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <div className="mt-0.5">{iconMap[step.status]}</div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${step.status === 'done' ? 'text-slate-300' : step.status === 'error' ? 'text-slate-200' : 'text-slate-500'}`}>
          {step.label}
        </p>
        <p className="text-xs text-slate-500 mt-0.5">{step.description}</p>
        {step.detail && (
          <p className={`text-xs mt-1 ${step.status === 'error' ? 'text-red-400/80' : 'text-slate-600'}`}>
            {step.detail}
          </p>
        )}
        {step.action && (
          <p className="text-xs text-amber-400/80 mt-1 font-medium">
            → {step.action}
          </p>
        )}
      </div>
    </div>
  )
}

function getMilestoneStatus(checks: boolean[]): 'done' | 'in_progress' | 'blocked' | 'pending' {
  const allDone = checks.every(Boolean)
  const someDone = checks.some(Boolean)
  if (allDone) return 'done'
  if (someDone) return 'in_progress'
  return 'blocked'
}
