'use client'

import { AlertTriangle, XCircle, Info } from 'lucide-react'

interface DataQualityBannerProps {
  missingMetrics: string[]
  derivedMetrics: Array<{ key: string; formula: string }>
  estimatedMetrics: string[]
}

export function DataQualityBanner({ missingMetrics, derivedMetrics, estimatedMetrics }: DataQualityBannerProps) {
  if (missingMetrics.length === 0 && derivedMetrics.length === 0 && estimatedMetrics.length === 0) {
    return null
  }

  return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 space-y-3">
      <h3 className="text-sm font-semibold text-slate-300">Data Quality</h3>

      {missingMetrics.length > 0 && (
        <div className="flex items-start gap-2">
          <XCircle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs text-red-400 font-medium">Missing</p>
            <p className="text-xs text-slate-500">{missingMetrics.join(', ')}</p>
          </div>
        </div>
      )}

      {derivedMetrics.length > 0 && (
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs text-amber-400 font-medium">Derived</p>
            {derivedMetrics.map(m => (
              <p key={m.key} className="text-xs text-slate-500">{m.key}: {m.formula}</p>
            ))}
          </div>
        </div>
      )}

      {estimatedMetrics.length > 0 && (
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 text-zinc-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs text-zinc-400 font-medium">Estimated</p>
            <p className="text-xs text-slate-500">{estimatedMetrics.join(', ')}</p>
          </div>
        </div>
      )}
    </div>
  )
}
