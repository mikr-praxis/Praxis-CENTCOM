// HubSpot CRM API client
// Docs: https://developers.hubspot.com/docs/api/crm/deals

import { getConfig } from '@/lib/config'

const HUBSPOT_API_URL = 'https://api.hubapi.com'

let hubspotClient: HubSpotClient | null = null
let _hubspotToken: string | null = null

class HubSpotClient {
  constructor(private token: string) {}

  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const url = `${HUBSPOT_API_URL}${endpoint}`
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.token}`,
      ...options?.headers,
    }

    const res = await fetch(url, {
      ...options,
      headers,
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`HubSpot API error ${res.status}: ${text}`)
    }

    return res.json() as Promise<T>
  }

  async listDeals(limit: number = 50): Promise<Deal[]> {
    const response = await this.request<{
      results: Array<{
        id: string
        properties: Record<string, string>
        associations?: {
          contacts?: {
            results: Array<{ id: string }>
          }
        }
      }>
    }>('/crm/v3/objects/deals', {
      method: 'GET',
    })

    return (response.results || []).map((deal) => ({
      id: deal.id,
      dealName: deal.properties.dealname || '',
      dealStage: deal.properties.dealstage || '',
      amount: deal.properties.amount ? parseFloat(deal.properties.amount) : 0,
      closeDate: deal.properties.closedate || '',
      pipeline: deal.properties.pipeline || '',
      contacts: deal.associations?.contacts?.results || [],
    }))
  }

  async getDeal(dealId: string): Promise<Deal | null> {
    const response = await this.request<{
      id: string
      properties: Record<string, string>
      associations?: {
        contacts?: {
          results: Array<{ id: string }>
        }
      }
    }>(`/crm/v3/objects/deals/${dealId}`, {
      method: 'GET',
    })

    return {
      id: response.id,
      dealName: response.properties.dealname || '',
      dealStage: response.properties.dealstage || '',
      amount: response.properties.amount ? parseFloat(response.properties.amount) : 0,
      closeDate: response.properties.closedate || '',
      pipeline: response.properties.pipeline || '',
      contacts: response.associations?.contacts?.results || [],
    }
  }

  async listContacts(limit: number = 50): Promise<Contact[]> {
    const response = await this.request<{
      results: Array<{
        id: string
        properties: Record<string, string>
      }>
    }>('/crm/v3/objects/contacts', {
      method: 'GET',
    })

    return (response.results || []).map((contact) => ({
      id: contact.id,
      firstName: contact.properties.firstname || '',
      lastName: contact.properties.lastname || '',
      email: contact.properties.email || '',
      phone: contact.properties.phone || '',
      company: contact.properties.company || '',
    }))
  }

  async getPipeline(): Promise<PipelineStage[]> {
    const response = await this.request<{
      results: Array<{
        id: string
        label: string
        displayOrder: number
      }>
    }>('/crm/v3/objects/deals/pipelines/default/stages', {
      method: 'GET',
    })

    return (response.results || []).map((stage) => ({
      id: stage.id,
      label: stage.label,
      displayOrder: stage.displayOrder || 0,
    }))
  }
}

export async function getHubSpotClient(): Promise<HubSpotClient> {
  const token = await getConfig('HUBSPOT_ACCESS_TOKEN')
  if (!token) {
    throw new Error('HUBSPOT_ACCESS_TOKEN is not set. Configure it at /config.')
  }

  // Re-create client if token changed (hot-swap after config edit)
  if (!hubspotClient || _hubspotToken !== token) {
    hubspotClient = new HubSpotClient(token)
    _hubspotToken = token
  }

  return hubspotClient
}

// ── Types ───────────────────────────────────────────────────────────────

export type Deal = {
  id: string
  dealName: string
  dealStage: string
  amount: number
  closeDate: string
  pipeline: string
  contacts: Array<{ id: string }>
}

export type Contact = {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  company: string
}

export type PipelineStage = {
  id: string
  label: string
  displayOrder: number
}
