// Runtime config resolver
// Checks Supabase app_config table first, falls back to process.env.
// Server-side only — never import this from client components.

import { createServerClient } from '@/lib/supabase/server'

// In-memory cache so we don't hit Supabase on every getConfig() call
// within the same request. Cleared on each new server invocation.
let _cache: Map<string, string> | null = null
let _cacheLoadedAt = 0
const CACHE_TTL_MS = 30_000 // 30 seconds

async function loadConfigCache(): Promise<Map<string, string>> {
  const now = Date.now()
  if (_cache && now - _cacheLoadedAt < CACHE_TTL_MS) return _cache

  try {
    const supabase = createServerClient()
    const { data } = await supabase.from('app_config').select('key, value')

    const map = new Map<string, string>()
    for (const row of data || []) {
      map.set(row.key, row.value)
    }
    _cache = map
    _cacheLoadedAt = now
    return map
  } catch {
    // If Supabase is unavailable or table doesn't exist yet, return empty
    return _cache || new Map()
  }
}

/**
 * Get a config value. Checks app_config table first, falls back to process.env.
 * Returns undefined if neither source has the key.
 */
export async function getConfig(key: string): Promise<string | undefined> {
  const cache = await loadConfigCache()
  return cache.get(key) || process.env[key] || undefined
}

/**
 * Get a config value or throw if missing.
 */
export async function requireConfig(key: string): Promise<string> {
  const value = await getConfig(key)
  if (!value) throw new Error(`Required config "${key}" is not set. Configure it at /config.`)
  return value
}

/**
 * Check whether a config key has a value (DB or env).
 */
export async function hasConfig(key: string): Promise<boolean> {
  const value = await getConfig(key)
  return !!value
}

/**
 * Save a config value to Supabase. Busts the cache immediately.
 */
export async function setConfig(key: string, value: string, userId?: string): Promise<void> {
  const supabase = createServerClient()
  const { error } = await supabase
    .from('app_config')
    .upsert(
      { key, value, updated_by: userId || null, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    )

  if (error) throw new Error(`Failed to save config "${key}": ${error.message}`)

  // Bust cache so the next read picks up the new value
  _cache = null
  _cacheLoadedAt = 0
}

/**
 * Delete a config value from Supabase (reverts to process.env fallback).
 */
export async function deleteConfig(key: string): Promise<void> {
  const supabase = createServerClient()
  await supabase.from('app_config').delete().eq('key', key)
  _cache = null
  _cacheLoadedAt = 0
}

/**
 * Invalidate the in-memory cache. Useful after bulk updates.
 */
export function bustConfigCache(): void {
  _cache = null
  _cacheLoadedAt = 0
}
