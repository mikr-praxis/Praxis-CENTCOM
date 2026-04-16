// Active Campaign API v3 client
// Docs: https://help.activecampaign.com/hc/en-us/articles/207317590-Getting-started-with-the-API

import { getConfig, requireConfig } from '@/lib/config'

let _baseUrl: string | null = null
let _apiKey: string | null = null

async function getBaseUrl(): Promise<string> {
  const url = await requireConfig('ACTIVECAMPAIGN_API_URL')
  return url
}

async function getApiKey(): Promise<string> {
  const key = await requireConfig('ACTIVECAMPAIGN_API_KEY')
  return key
}

/**
 * Make an authenticated request to the Active Campaign API.
 * Base URL is the user's account URL (e.g., https://youraccountname.api-us1.com)
 * Auth is via Api-Token header.
 */
async function apiRequest<T = Record<string, unknown>>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const baseUrl = await getBaseUrl()
  const apiKey = await getApiKey()

  const url = `${baseUrl}/api/3/${endpoint}`
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Api-Token': apiKey,
      ...options.headers,
    },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Active Campaign API error ${res.status}: ${text}`)
  }

  return res.json() as Promise<T>
}

// ── Types ───────────────────────────────────────────────────────────────

export type Campaign = {
  id: string
  name: string
  subject: string
  status: string // 'draft', 'scheduled', 'sent', etc.
  sendDate?: string
  opens?: number
  clicks?: number
  bounces?: number
  unsubscribes?: number
  sends?: number
  createdDate?: string
  updatedDate?: string
}

export type Automation = {
  id: string
  name: string
  status: string // 'draft', 'published', 'archived', etc.
  entryCount?: number
  contactCount?: number
  createdDate?: string
  updatedDate?: string
}

export type Contact = {
  id: string
  email: string
  firstName?: string
  lastName?: string
  phone?: string
  status?: string // 'subscribed', 'unsubscribed', etc.
  createdDate?: string
  updatedDate?: string
}

export type CampaignStats = {
  sends: number
  opens: number
  clicks: number
  bounces: number
  unsubscribes: number
  openRate: number
  clickRate: number
  bounceRate: number
}

// ── API Methods ─────────────────────────────────────────────────────────

/**
 * List email campaigns with stats.
 * Params:
 *  - limit: Maximum number of campaigns to fetch (default 50, max 100)
 */
export async function listCampaigns(limit: number = 50): Promise<Campaign[]> {
  const data = await apiRequest<{ campaigns: Campaign[] }>(
    `campaigns?limit=${Math.min(limit, 100)}`
  )

  return data.campaigns || []
}

/**
 * Get a single campaign with detailed stats.
 */
export async function getCampaign(campaignId: string): Promise<Campaign> {
  const data = await apiRequest<{ campaign: Campaign }>(`campaigns/${campaignId}`)
  return data.campaign
}

/**
 * List automations with status and contact count.
 * Params:
 *  - limit: Maximum number of automations to fetch (default 50, max 100)
 */
export async function listAutomations(limit: number = 50): Promise<Automation[]> {
  const data = await apiRequest<{ automations: Automation[] }>(
    `automations?limit=${Math.min(limit, 100)}`
  )

  return data.automations || []
}

/**
 * List contacts/subscribers with optional search.
 * Params:
 *  - limit: Maximum number of contacts to fetch (default 50, max 100)
 *  - search: Optional search term (searches email, name, etc.)
 */
export async function listContacts(limit: number = 50, search?: string): Promise<Contact[]> {
  let endpoint = `contacts?limit=${Math.min(limit, 100)}`
  if (search) {
    endpoint += `&search=${encodeURIComponent(search)}`
  }

  const data = await apiRequest<{ contacts: Contact[] }>(endpoint)
  return data.contacts || []
}

/**
 * Calculate stats for a campaign (open rate, click rate, bounce rate, etc.)
 */
export function calculateCampaignStats(campaign: Campaign): CampaignStats {
  const sends = campaign.sends || 0
  const opens = campaign.opens || 0
  const clicks = campaign.clicks || 0
  const bounces = campaign.bounces || 0
  const unsubscribes = campaign.unsubscribes || 0

  const openRate = sends > 0 ? (opens / sends) * 100 : 0
  const clickRate = sends > 0 ? (clicks / sends) * 100 : 0
  const bounceRate = sends > 0 ? (bounces / sends) * 100 : 0

  return {
    sends,
    opens,
    clicks,
    bounces,
    unsubscribes,
    openRate: Math.round(openRate * 100) / 100,
    clickRate: Math.round(clickRate * 100) / 100,
    bounceRate: Math.round(bounceRate * 100) / 100,
  }
}
