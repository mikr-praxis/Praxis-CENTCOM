'use client'

interface FunnelStage {
  label: string
  value: number
  metricKey: string
}

interface FunnelVizProps {
  stages: FunnelStage[]
}

export function FunnelViz({ stages }: FunnelVizProps) {
  if (stages.length === 0) return null

  const maxValue = stages[0]?.value || 1

  return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 space-y-3">
      <h3 className="text-sm font-semibold text-slate-300">Funnel</h3>
      <div className="space-y-2">
        {stages.map((stage, i) => {
          const widthPct = Math.max((stage.value / maxValue) * 100, 8)
          const prevValue = i > 0 ? stages[i - 1].value : null
          const conversionRate = prevValue && prevValue > 0 ? stage.value / prevValue : null

          return (
            <div key={stage.metricKey}>
              {conversionRate !== null && (
                <div className="flex items-center gap-2 pl-2 py-0.5">
                  <div className="h-px flex-1 bg-zinc-800" />
                  <span className="text-[10px] text-slate-500">
                    {(conversionRate * 100).toFixed(1)}%
                  </span>
                  <div className="h-px flex-1 bg-zinc-800" />
                </div>
              )}
              <div className="flex items-center gap-3">
                <div className="w-24 text-right">
                  <span className="text-xs text-slate-400">{stage.label}</span>
                </div>
                <div className="flex-1 relative">
                  <div
                    className="h-8 rounded bg-gradient-to-r from-indigo-500/30 to-indigo-500/10 border border-indigo-500/20 flex items-center px-3 transition-all"
                    style={{ width: `${widthPct}%` }}
                  >
                    <span className="text-xs font-medium text-slate-200">
                      {stage.value.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
