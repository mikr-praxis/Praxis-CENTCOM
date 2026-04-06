'use client'

import { useState, useEffect, useCallback } from 'react'

type DeployState = 'idle' | 'building' | 'ready' | 'error' | 'loading'

interface Deployment {
  state: DeployState
  url?: string
  createdAt?: string
  commitMessage?: string
}

export function DeployStatus() {
  const [deploy, setDeploy] = useState<Deployment>({ state: 'loading' })
  const [expanded, setExpanded] = useState(false)
  const [lastChecked, setLastChecked] = useState<Date>(new Date())

  const checkDeploy = useCallback(async () => {
    try {
      const res = await fetch('/api/deploy-status')
      if (!res.ok) {
        setDeploy({ state: 'idle' })
        return
      }
      const data = await res.json()
      setDeploy(data)
      setLastChecked(new Date())
    } catch {
      setDeploy({ state: 'idle' })
    }
  }, [])

  useEffect(() => {
    checkDeploy()
    // Poll every 15s when building, every 60s otherwise
    const interval = setInterval(checkDeploy, deploy.state === 'building' ? 15000 : 60000)
    return () => clearInterval(interval)
  }, [checkDeploy, deploy.state])

  const stateConfig = {
    loading: { color: 'bg-slate-500', pulse: true, label: 'Checking...', icon: '◌' },
    idle: { color: 'bg-slate-500', pulse: false, label: 'No recent deploys', icon: '○' },
    building: { color: 'bg-amber-500', pulse: true, label: 'Building...', icon: '◉' },
    ready: { color: 'bg-emerald-500', pulse: false, label: 'Live', icon: '●' },
    error: { color: 'bg-red-500', pulse: false, label: 'Failed', icon: '✕' },
  }

  const config = stateConfig[deploy.state]

  const timeAgo = deploy.createdAt
    ? getTimeAgo(new Date(deploy.createdAt))
    : null

  return (
    <div className="fixed bottom-20 right-4 z-50 md:bottom-4 hidden md:block">
      {expanded && (
        <div className="mb-2 w-64 sm:w-72 rounded-xl border border-slate-700/50 bg-slate-800/95 p-4 shadow-2xl backdrop-blur-sm">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-100">Deploy Status</span>
            <button
              onClick={() => checkDeploy()}
              className="text-xs text-slate-400 hover:text-amber-400 transition-colors"
            >
              Refresh
            </button>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${config.color} ${config.pulse ? 'animate-pulse' : ''}`} />
              <span className="text-sm text-slate-300">{config.label}</span>
            </div>

            {deploy.commitMessage && (
              <p className="text-xs text-slate-400 truncate">
                &quot;{deploy.commitMessage}&quot;
              </p>
            )}

            {timeAgo && (
              <p className="text-xs text-slate-500">{timeAgo}</p>
            )}

            {deploy.url && deploy.state === 'ready' && (
              <a
                href={deploy.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 block text-xs text-amber-400 hover:text-amber-300 truncate"
              >
                {deploy.url}
              </a>
            )}
          </div>

          <div className="mt-3 border-t border-slate-700/50 pt-2">
            <p className="text-xs text-slate-600">
              Last checked: {lastChecked.toLocaleTimeString()}
            </p>
          </div>
        </div>
      )}

      <button
        onClick={() => setExpanded(!expanded)}
        className={`flex items-center gap-2 rounded-full border border-slate-700/50 bg-slate-800/95 px-3 py-2 shadow-lg backdrop-blur-sm transition-all hover:border-slate-600 ${
          deploy.state === 'building' ? 'border-amber-500/50' : ''
        }`}
      >
        <span className={`h-2.5 w-2.5 rounded-full ${config.color} ${config.pulse ? 'animate-pulse' : ''}`} />
        <span className="text-xs font-medium text-slate-300">{config.label}</span>
      </button>
    </div>
  )
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return 'Just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}
