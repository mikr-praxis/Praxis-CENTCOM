// GitHub OAuth2 client and API helpers
// Config keys: GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GITHUB_APP_ID
// Tokens stored in Supabase github_tokens table per user.

import { getConfig } from '@/lib/config'

const GITHUB_AUTH_URL = 'https://github.com/login/oauth/authorize'
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token'
const GITHUB_API_BASE = 'https://api.github.com'

// Default scopes for repo + user info access
const DEFAULT_SCOPES = ['read:user', 'user:email', 'repo']

/**
 * Build the GitHub OAuth authorization URL.
 * Redirects the user to GitHub's consent screen.
 */
export async function getAuthorizationUrl(userId: string): Promise<string> {
  const clientId = await getConfig('GITHUB_CLIENT_ID')
  const redirectUri = await getRedirectUri()

  if (!clientId) {
    throw new Error(
      'GitHub OAuth credentials are not set. ' +
      'Configure GITHUB_CLIENT_ID at /config.'
    )
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: DEFAULT_SCOPES.join(' '),
    state: userId,
    allow_signup: 'false',
  })

  return `${GITHUB_AUTH_URL}?${params.toString()}`
}

/**
 * Exchange an authorization code for an access token.
 */
export async function exchangeCodeForToken(code: string): Promise<{
  access_token: string
  token_type: string
  scope: string
}> {
  const clientId = await getConfig('GITHUB_CLIENT_ID')
  const clientSecret = await getConfig('GITHUB_CLIENT_SECRET')

  if (!clientId || !clientSecret) {
    throw new Error('GitHub OAuth credentials not configured.')
  }

  const res = await fetch(GITHUB_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    }),
  })

  if (!res.ok) {
    throw new Error(`GitHub token exchange failed: ${res.status}`)
  }

  const data = await res.json()

  if (data.error) {
    throw new Error(`GitHub OAuth error: ${data.error_description || data.error}`)
  }

  return data
}

/**
 * Fetch the authenticated user's GitHub profile.
 */
export async function getGitHubUser(accessToken: string): Promise<{
  login: string
  id: number
  avatar_url: string
  name: string | null
  email: string | null
}> {
  const res = await fetch(`${GITHUB_API_BASE}/user`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })

  if (!res.ok) {
    throw new Error(`Failed to fetch GitHub user: ${res.status}`)
  }

  return res.json()
}

/**
 * Fetch the authenticated user's repositories.
 */
export async function getGitHubRepos(
  accessToken: string,
  opts: { per_page?: number; sort?: string; page?: number } = {}
): Promise<Array<{
  id: number
  name: string
  full_name: string
  private: boolean
  html_url: string
  description: string | null
  language: string | null
  updated_at: string
  stargazers_count: number
  default_branch: string
}>> {
  const params = new URLSearchParams({
    per_page: String(opts.per_page || 30),
    sort: opts.sort || 'updated',
    page: String(opts.page || 1),
    type: 'all',
  })

  const res = await fetch(`${GITHUB_API_BASE}/user/repos?${params}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })

  if (!res.ok) {
    throw new Error(`Failed to fetch GitHub repos: ${res.status}`)
  }

  return res.json()
}

/**
 * Revoke a GitHub OAuth token (delete the app authorization).
 */
export async function revokeToken(accessToken: string): Promise<void> {
  const clientId = await getConfig('GITHUB_CLIENT_ID')
  const clientSecret = await getConfig('GITHUB_CLIENT_SECRET')

  if (!clientId || !clientSecret) return

  // GitHub's token revocation endpoint uses Basic auth
  const credentials = btoa(`${clientId}:${clientSecret}`)

  await fetch(`${GITHUB_API_BASE}/applications/${clientId}/token`, {
    method: 'DELETE',
    headers: {
      Authorization: `Basic ${credentials}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({ access_token: accessToken }),
  })
}

/**
 * Get the configured redirect URI for OAuth callback.
 */
async function getRedirectUri(): Promise<string> {
  const configured = await getConfig('GITHUB_REDIRECT_URI')
  if (configured) return configured

  const appUrl = await getConfig('NEXT_PUBLIC_APP_URL')
  return `${appUrl || ''}/api/auth/github/callback`
}
