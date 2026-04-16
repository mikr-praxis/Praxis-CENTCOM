import type { FunnelType, CanonicalMetric } from './types'
import { CALL_FUNNEL_METRICS, CALL_FUNNEL_STAGES, CALL_FUNNEL_BENCHMARKS, CALL_FUNNEL_KPI_KEYS } from './call-funnel'
import { WEBINAR_FUNNEL_METRICS, WEBINAR_FUNNEL_STAGES, WEBINAR_FUNNEL_BENCHMARKS, WEBINAR_FUNNEL_KPI_KEYS } from './webinar-funnel'
import { CHALLENGE_FUNNEL_METRICS, CHALLENGE_FUNNEL_STAGES, CHALLENGE_FUNNEL_BENCHMARKS, CHALLENGE_FUNNEL_KPI_KEYS } from './challenge-funnel'

export function getMetricsForFunnel(funnelType: FunnelType): CanonicalMetric[] {
  switch (funnelType) {
    case 'call': return CALL_FUNNEL_METRICS
    case 'webinar': return WEBINAR_FUNNEL_METRICS
    case 'challenge': return CHALLENGE_FUNNEL_METRICS
  }
}

export function getStagesForFunnel(funnelType: FunnelType) {
  switch (funnelType) {
    case 'call': return CALL_FUNNEL_STAGES
    case 'webinar': return WEBINAR_FUNNEL_STAGES
    case 'challenge': return CHALLENGE_FUNNEL_STAGES
  }
}

export function getBenchmarksForFunnel(funnelType: FunnelType) {
  switch (funnelType) {
    case 'call': return CALL_FUNNEL_BENCHMARKS
    case 'webinar': return WEBINAR_FUNNEL_BENCHMARKS
    case 'challenge': return CHALLENGE_FUNNEL_BENCHMARKS
  }
}

export function getKPIKeysForFunnel(funnelType: FunnelType) {
  switch (funnelType) {
    case 'call': return CALL_FUNNEL_KPI_KEYS
    case 'webinar': return WEBINAR_FUNNEL_KPI_KEYS
    case 'challenge': return CHALLENGE_FUNNEL_KPI_KEYS
  }
}

export function formatMetricValue(value: number, type: CanonicalMetric['type']): string {
  switch (type) {
    case 'currency':
      return value >= 1000
        ? `$${(value / 1000).toFixed(1)}k`
        : `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
    case 'percent':
      return `${(value * 100).toFixed(1)}%`
    case 'ratio':
      return `${value.toFixed(1)}x`
    case 'count':
      return value >= 1000
        ? `${(value / 1000).toFixed(1)}k`
        : value.toLocaleString('en-US', { maximumFractionDigits: 0 })
  }
}

export * from './types'
