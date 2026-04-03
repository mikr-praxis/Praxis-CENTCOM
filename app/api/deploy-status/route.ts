import { NextResponse } from 'next/server'

export async function GET() {
  const token = process.env.VERCEL_API_TOKEN
  const projectId = process.env.VERCEL_PROJECT_ID

  // If no Vercel token configured, return idle
  if (!token || !projectId) {
    return NextResponse.json({
      state: 'idle',
      commitMessage: 'Vercel API not configured — add VERCEL_API_TOKEN and VERCEL_PROJECT_ID',
    })
  }

  try {
    const res = await fetch(
      `https://api.vercel.com/v6/deployments?projectId=${projectId}&limit=1&target=production`,
      {
        headers: { Authorization: `Bearer ${token}` },
        next: { revalidate: 10 },
      }
    )

    if (!res.ok) {
      return NextResponse.json({ state: 'error' })
    }

    const data = await res.json()
    const latest = data.deployments?.[0]

    if (!latest) {
      return NextResponse.json({ state: 'idle' })
    }

    // Map Vercel states to our states
    const stateMap: Record<string, string> = {
      BUILDING: 'building',
      INITIALIZING: 'building',
      QUEUED: 'building',
      READY: 'ready',
      ERROR: 'error',
      CANCELED: 'error',
    }

    return NextResponse.json({
      state: stateMap[latest.state] || 'idle',
      url: latest.url ? `https://${latest.url}` : undefined,
      createdAt: latest.created ? new Date(latest.created).toISOString() : undefined,
      commitMessage: latest.meta?.githubCommitMessage || latest.name || '',
    })
  } catch {
    return NextResponse.json({ state: 'error' })
  }
}
