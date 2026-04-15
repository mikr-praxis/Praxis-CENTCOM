import { promises as fs } from 'fs'
import path from 'path'

export type MemoryType = 'user' | 'project' | 'feedback' | 'reference'

export type MemoryEntry = {
  slug: string
  name: string
  description: string
  type: MemoryType
  body: string
}

const MEMORY_DIR = path.join(process.cwd(), 'content', 'memory')

/** Parse a simple YAML-frontmatter block: --- key: value ---  */
function parseFrontmatter(raw: string): { data: Record<string, string>; body: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!match) return { data: {}, body: raw }

  const data: Record<string, string> = {}
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':')
    if (idx === -1) continue
    const key = line.slice(0, idx).trim()
    const value = line.slice(idx + 1).trim()
    data[key] = value
  }
  return { data, body: match[2].trim() }
}

/** Load all memory entries (skips MEMORY.md index). */
export async function loadMemories(): Promise<MemoryEntry[]> {
  let files: string[] = []
  try {
    files = await fs.readdir(MEMORY_DIR)
  } catch {
    return []
  }

  const entries: MemoryEntry[] = []
  for (const file of files) {
    if (!file.endsWith('.md') || file === 'MEMORY.md') continue
    const raw = await fs.readFile(path.join(MEMORY_DIR, file), 'utf8')
    const { data, body } = parseFrontmatter(raw)
    entries.push({
      slug: file.replace(/\.md$/, ''),
      name: data.name || file,
      description: data.description || '',
      type: (data.type as MemoryType) || 'project',
      body,
    })
  }

  // Stable sort: user → project → reference → feedback
  const order: Record<MemoryType, number> = { user: 0, project: 1, reference: 2, feedback: 3 }
  entries.sort((a, b) => (order[a.type] ?? 99) - (order[b.type] ?? 99) || a.name.localeCompare(b.name))
  return entries
}
