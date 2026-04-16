import Anthropic from '@anthropic-ai/sdk'
import { getConfig } from '@/lib/config'

// Re-export agent types and config from the standalone module so server
// code can still do `import { AGENTS } from '@/lib/anthropic/agents'`
export { AGENTS } from '@/lib/agents/config'
export type { AgentDef } from '@/lib/agents/config'

let _anthropic: Anthropic | null = null
let _anthropicKey: string | null = null

/**
 * Returns an Anthropic client. Checks app_config DB first, then env vars.
 * Re-creates the client if the stored key changes (e.g. after config update).
 */
export async function getAnthropicClient(): Promise<Anthropic> {
  let key: string | undefined
  try {
    key = await getConfig('ANTHROPIC_API_KEY')
  } catch {
    // Config lookup failed (app_config table missing) — fall back to env
    key = process.env.ANTHROPIC_API_KEY
  }
  if (!key) {
    throw new Error('ANTHROPIC_API_KEY is not set. Configure it at /config or add it to Vercel env vars.')
  }

  // Re-create client if the key changed (hot-swap after config edit)
  if (!_anthropic || _anthropicKey !== key) {
    _anthropic = new Anthropic({ apiKey: key })
    _anthropicKey = key
  }
  return _anthropic
}
