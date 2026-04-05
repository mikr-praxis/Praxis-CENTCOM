import Anthropic from '@anthropic-ai/sdk'

// Re-export agent types and config from the standalone module so server
// code can still do `import { AGENTS } from '@/lib/anthropic/agents'`
export { AGENTS } from '@/lib/agents/config'
export type { AgentDef } from '@/lib/agents/config'

let _anthropic: Anthropic | null = null

export function getAnthropicClient(): Anthropic {
  if (!_anthropic) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is not set')
    }
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }
  return _anthropic
}
