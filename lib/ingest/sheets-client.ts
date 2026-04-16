import type { SheetTabData } from '@/lib/metrics/types'

interface SheetsConfig {
  serviceAccountEmail: string
  serviceAccountKey: string
}

function getConfig(): SheetsConfig {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  if (!email || !key) {
    throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_SERVICE_ACCOUNT_KEY env vars')
  }
  return { serviceAccountEmail: email, serviceAccountKey: key }
}

async function getAccessToken(config: SheetsConfig): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({
    iss: config.serviceAccountEmail,
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  })).toString('base64url')

  // Parse the service account key JSON to get the private key
  let privateKeyPem: string
  try {
    const keyData = JSON.parse(config.serviceAccountKey)
    privateKeyPem = keyData.private_key
  } catch {
    // Key might be base64-encoded JSON
    const decoded = Buffer.from(config.serviceAccountKey, 'base64').toString('utf-8')
    const keyData = JSON.parse(decoded)
    privateKeyPem = keyData.private_key
  }

  const crypto = await import('crypto')
  const sign = crypto.createSign('RSA-SHA256')
  sign.update(`${header}.${payload}`)
  const signature = sign.sign(privateKeyPem, 'base64url')

  const jwt = `${header}.${payload}.${signature}`

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })

  if (!tokenRes.ok) {
    const err = await tokenRes.text()
    throw new Error(`Failed to get access token: ${err}`)
  }

  const tokenData = await tokenRes.json()
  return tokenData.access_token
}

export function extractSpreadsheetId(url: string): string {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  if (!match) throw new Error(`Invalid Google Sheets URL: ${url}`)
  return match[1]
}

export async function listSheetTabs(spreadsheetId: string): Promise<string[]> {
  const config = getConfig()
  const token = await getAccessToken(config)

  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`,
    { headers: { Authorization: `Bearer ${token}` } }
  )

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Failed to list sheet tabs: ${err}`)
  }

  const data = await res.json()
  return data.sheets.map((s: { properties: { title: string } }) => s.properties.title)
}

export async function readSheetTab(
  spreadsheetId: string,
  tabName: string,
  maxRows: number = 100
): Promise<string[][]> {
  const config = getConfig()
  const token = await getAccessToken(config)

  const range = `'${tabName}'!A1:ZZ${maxRows}`
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  )

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Failed to read sheet tab "${tabName}": ${err}`)
  }

  const data = await res.json()
  return data.values || []
}

export async function readAllTabs(spreadsheetId: string): Promise<SheetTabData[]> {
  const tabs = await listSheetTabs(spreadsheetId)
  const results: SheetTabData[] = []

  for (const tabName of tabs) {
    const rows = await readSheetTab(spreadsheetId, tabName, 10)
    if (rows.length === 0) continue

    // First non-empty row is headers
    const headerRowIndex = rows.findIndex(row => row.some(cell => cell?.trim()))
    if (headerRowIndex === -1) continue

    const headers = rows[headerRowIndex].map(h => h?.trim() || '')
    const sampleRows = rows
      .slice(headerRowIndex + 1)
      .filter(row => row.some(cell => cell?.trim()))
      .slice(0, 5)

    results.push({ name: tabName, headers, sampleRows })
  }

  return results
}
