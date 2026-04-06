// Monday.com GraphQL API client
// Docs: https://developer.monday.com/api-reference

import { getConfig } from '@/lib/config'

const MONDAY_API_URL = 'https://api.monday.com/v2'

// ── Retry & Error Recovery ─────────────────────────────────────────────

type RetryOptions = {
  maxRetries?: number
  baseDelay?: number
  maxDelay?: number
}

const DEFAULT_RETRY: RetryOptions = {
  maxRetries: 3,
  baseDelay: 500,
  maxDelay: 5000,
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export type MondayError = {
  code: 'NO_TOKEN' | 'RATE_LIMITED' | 'API_ERROR' | 'GRAPHQL_ERROR' | 'NETWORK_ERROR'
  message: string
  status?: number
  retryAfter?: number
}

function createMondayError(
  code: MondayError['code'],
  message: string,
  opts?: { status?: number; retryAfter?: number }
): MondayError & Error {
  const err = new Error(message) as MondayError & Error
  err.code = code
  err.status = opts?.status
  err.retryAfter = opts?.retryAfter
  return err
}

// ── In-memory stale-while-revalidate cache ──────────────────────────────

type CacheEntry<T> = {
  data: T
  fetchedAt: number
  staleAt: number  // serve stale data after this, but revalidate
  expireAt: number // don't serve at all after this
}

const queryCache = new Map<string, CacheEntry<unknown>>()

const CACHE_FRESH_MS = 30_000  // 30s fresh
const CACHE_STALE_MS = 120_000 // 2min stale-but-servable
const CACHE_MAX_MS = 300_000   // 5min hard expire

function getCacheKey(query: string, variables?: Record<string, unknown>): string {
  return `${query}:${JSON.stringify(variables || {})}`
}

function getCached<T>(key: string): { data: T; isStale: boolean } | null {
  const entry = queryCache.get(key) as CacheEntry<T> | undefined
  if (!entry) return null

  const now = Date.now()
  if (now > entry.expireAt) {
    queryCache.delete(key)
    return null
  }

  return {
    data: entry.data,
    isStale: now > entry.staleAt,
  }
}

function setCache<T>(key: string, data: T) {
  const now = Date.now()
  queryCache.set(key, {
    data,
    fetchedAt: now,
    staleAt: now + CACHE_FRESH_MS,
    expireAt: now + CACHE_MAX_MS,
  })
}

export function clearMondayCache() {
  queryCache.clear()
}

// ── Token ──────────────────────────────────────────────────────────────

async function getToken() {
  const token = await getConfig('MONDAY_API_KEY')
  if (!token) throw createMondayError('NO_TOKEN', 'MONDAY_API_KEY is not set. Configure it at /config.')
  return token
}

// ── Core Query with Retry + Cache ──────────────────────────────────────

export async function mondayQuery<T = Record<string, unknown>>(
  query: string,
  variables?: Record<string, unknown>,
  opts?: RetryOptions & { skipCache?: boolean }
): Promise<T> {
  const { maxRetries, baseDelay, maxDelay } = { ...DEFAULT_RETRY, ...opts }
  const cacheKey = getCacheKey(query, variables)

  // Check cache first (unless skipCache)
  if (!opts?.skipCache) {
    const cached = getCached<T>(cacheKey)
    if (cached && !cached.isStale) {
      return cached.data
    }
    // If stale, we'll try to revalidate but return stale on failure
    if (cached?.isStale) {
      try {
        const fresh = await mondayQueryRaw<T>(query, variables, { maxRetries: 1, baseDelay, maxDelay })
        setCache(cacheKey, fresh)
        return fresh
      } catch {
        // Return stale data on revalidation failure
        return cached.data
      }
    }
  }

  const data = await mondayQueryRaw<T>(query, variables, { maxRetries, baseDelay, maxDelay })
  setCache(cacheKey, data)
  return data
}

async function mondayQueryRaw<T>(
  query: string,
  variables?: Record<string, unknown>,
  opts?: RetryOptions
): Promise<T> {
  const { maxRetries = 3, baseDelay = 500, maxDelay = 5000 } = opts || {}
  const token = await getToken()

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries!; attempt++) {
    try {
      const res = await fetch(MONDAY_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token,
          'API-Version': '2024-10',
        },
        body: JSON.stringify({ query, variables }),
      })

      // Rate limited — respect Retry-After header
      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get('Retry-After') || '30', 10)
        if (attempt < maxRetries!) {
          await sleep(Math.min(retryAfter * 1000, maxDelay!))
          continue
        }
        throw createMondayError('RATE_LIMITED', 'Monday.com rate limit exceeded', {
          status: 429,
          retryAfter,
        })
      }

      if (!res.ok) {
        const text = await res.text()
        throw createMondayError('API_ERROR', `Monday.com API error ${res.status}: ${text}`, {
          status: res.status,
        })
      }

      const json = await res.json()
      if (json.errors) {
        throw createMondayError('GRAPHQL_ERROR', `Monday.com GraphQL errors: ${JSON.stringify(json.errors)}`)
      }

      return json.data as T
    } catch (err) {
      lastError = err as Error
      const mondayErr = err as MondayError

      // Don't retry config errors or GraphQL errors
      if (mondayErr.code === 'NO_TOKEN' || mondayErr.code === 'GRAPHQL_ERROR') {
        throw err
      }

      // Retry with exponential backoff
      if (attempt < maxRetries!) {
        const delay = Math.min(baseDelay! * Math.pow(2, attempt), maxDelay!)
        await sleep(delay)
        continue
      }
    }
  }

  throw lastError || createMondayError('NETWORK_ERROR', 'Monday.com request failed after retries')
}

// ── Types ───────────────────────────────────────────────────────────────

export type MondayUser = {
  id: string
  name: string
  email: string
  photo_thumb_small: string | null
}

export type MondayItem = {
  id: string
  name: string
  state: string // active, archived, deleted
  board: { id: string; name: string }
  group: { id: string; title: string }
  column_values: {
    id: string
    title: string
    text: string
    type: string
    value: string | null
  }[]
  subscribers: { id: string; name: string }[]
}

export type MondayTask = {
  id: string
  name: string
  boardName: string
  boardId: string
  groupName: string
  groupId: string
  status: string | null
  dueDate: string | null
  assignees: { id: string; name: string }[]
  priority: string | null
  timelineStart: string | null
  timelineEnd: string | null
}

export type MondayBoard = {
  id: string
  name: string
  board_kind: string
  state: string
  columns: {
    id: string
    title: string
    type: string
  }[]
}

export type MondayUpdate = {
  id: string
  text_body: string
  creator: {
    id: string
    name: string
  }
  created_at: string
}

// ── Column Mapping ─────────────────────────────────────────────────────
// Configurable column type/name mappings for flexible extraction

export type ColumnMapping = {
  statusTypes: string[]
  statusTitles: string[]
  dateTitles: string[]
  priorityTitles: string[]
}

const DEFAULT_COLUMN_MAPPING: ColumnMapping = {
  statusTypes: ['status', 'color'],
  statusTitles: ['status', 'stage', 'state', 'progress'],
  dateTitles: ['due', 'date', 'deadline', 'end date', 'delivery', 'target'],
  priorityTitles: ['priority', 'urgency', 'importance', 'p0', 'p1', 'p2'],
}

let _columnMapping: ColumnMapping = DEFAULT_COLUMN_MAPPING

export function setColumnMapping(mapping: Partial<ColumnMapping>) {
  _columnMapping = { ...DEFAULT_COLUMN_MAPPING, ...mapping }
}

export function getColumnMapping(): ColumnMapping {
  return _columnMapping
}

// ── Queries ─────────────────────────────────────────────────────────────

const BOARD_FIELDS = `id name board_kind state columns { id title type }`

const ITEM_FIELDS = `
  id name state
  board { id name }
  group { id title }
  column_values { id title text type value }
  subscribers { id name }
`

export async function getBoards(): Promise<{ id: string; name: string }[]> {
  const data = await mondayQuery<{
    boards: { id: string; name: string }[]
  }>(`query { boards(limit: 50) { id name } }`)
  return data.boards
}

export async function listBoards(): Promise<MondayBoard[]> {
  const data = await mondayQuery<{
    boards: MondayBoard[]
  }>(`query { boards(limit: 50) { ${BOARD_FIELDS} } }`)
  return data.boards
}

export async function getBoardItems(boardIds: string[]): Promise<MondayItem[]> {
  const data = await mondayQuery<{
    boards: { items_page: { items: MondayItem[] } }[]
  }>(`query ($ids: [ID!]!) {
    boards(ids: $ids) {
      items_page(limit: 200) { items { ${ITEM_FIELDS} } }
    }
  }`, { ids: boardIds })
  return data.boards.flatMap((b) => b.items_page.items)
}

// Paginated board items with cursor support
export async function getBoardItemsPaginated(
  boardId: string,
  limit: number = 50,
  cursor?: string
): Promise<{ items: MondayItem[]; cursor: string | null }> {
  if (cursor) {
    const data = await mondayQuery<{
      next_items_page: { cursor: string | null; items: MondayItem[] }
    }>(`query ($cursor: String!, $limit: Int!) {
      next_items_page(cursor: $cursor, limit: $limit) {
        cursor
        items { ${ITEM_FIELDS} }
      }
    }`, { cursor, limit }, { skipCache: true })
    return { items: data.next_items_page.items, cursor: data.next_items_page.cursor }
  }

  const data = await mondayQuery<{
    boards: { items_page: { cursor: string | null; items: MondayItem[] } }[]
  }>(`query ($id: [ID!]!, $limit: Int!) {
    boards(ids: $id) {
      items_page(limit: $limit) {
        cursor
        items { ${ITEM_FIELDS} }
      }
    }
  }`, { id: [boardId], limit }, { skipCache: true })

  const page = data.boards[0]?.items_page
  return { items: page?.items || [], cursor: page?.cursor || null }
}

export async function getBoardItemsById(boardId: string, limit?: number): Promise<MondayItem[]> {
  const queryLimit = limit || 200
  const data = await mondayQuery<{
    boards: { items_page: { items: MondayItem[] } }[]
  }>(`query ($id: [ID!]!, $limit: Int!) {
    boards(ids: $id) {
      items_page(limit: $limit) { items { ${ITEM_FIELDS} } }
    }
  }`, { id: [boardId], limit: queryLimit })
  return data.boards[0]?.items_page.items || []
}

export async function getUsers(): Promise<MondayUser[]> {
  const data = await mondayQuery<{ users: MondayUser[] }>(
    `query { users(limit: 50) { id name email photo_thumb_small } }`
  )
  return data.users
}

export async function getItemUpdates(itemId: string, limit?: number): Promise<MondayUpdate[]> {
  const queryLimit = limit || 50
  const data = await mondayQuery<{
    items: { updates: MondayUpdate[] }[]
  }>(`query ($id: [ID!]!, $limit: Int!) {
    items(ids: $id) {
      updates(limit: $limit) {
        id text_body
        creator { id name }
        created_at
      }
    }
  }`, { id: [itemId], limit: queryLimit })
  return data.items[0]?.updates || []
}

// ── Mutations ──────────────────────────────────────────────────────────

export async function createItem(
  boardId: string,
  groupId: string,
  itemName: string,
  columnValues?: Record<string, unknown>
): Promise<{ id: string; name: string }> {
  const columnValuesJson = columnValues ? JSON.stringify(columnValues) : '{}'

  const data = await mondayQuery<{
    create_item: { id: string; name: string }
  }>(`mutation ($boardId: ID!, $groupId: String!, $itemName: String!, $columnValues: JSON) {
    create_item(
      board_id: $boardId
      group_id: $groupId
      item_name: $itemName
      column_values: $columnValues
    ) { id name }
  }`, { boardId, groupId, itemName, columnValues: columnValuesJson }, { skipCache: true })

  clearMondayCache() // Invalidate after mutation
  return data.create_item
}

export async function updateItem(
  boardId: string,
  itemId: string,
  columnValues: Record<string, unknown>
): Promise<{ id: string }> {
  const columnValuesJson = JSON.stringify(columnValues)

  const data = await mondayQuery<{
    change_multiple_column_values: { id: string }
  }>(`mutation ($boardId: ID!, $itemId: ID!, $columnValues: JSON!) {
    change_multiple_column_values(
      board_id: $boardId
      item_id: $itemId
      column_values: $columnValues
    ) { id }
  }`, { boardId, itemId, columnValues: columnValuesJson }, { skipCache: true })

  clearMondayCache()
  return data.change_multiple_column_values
}

export async function archiveItem(itemId: string): Promise<{ id: string }> {
  const data = await mondayQuery<{
    archive_item: { id: string }
  }>(`mutation ($itemId: ID!) {
    archive_item(item_id: $itemId) { id }
  }`, { itemId }, { skipCache: true })

  clearMondayCache()
  return data.archive_item
}

export async function deleteItem(itemId: string): Promise<{ id: string }> {
  const data = await mondayQuery<{
    delete_item: { id: string }
  }>(`mutation ($itemId: ID!) {
    delete_item(item_id: $itemId) { id }
  }`, { itemId }, { skipCache: true })

  clearMondayCache()
  return data.delete_item
}

export async function moveItemToGroup(
  itemId: string,
  groupId: string
): Promise<{ id: string }> {
  const data = await mondayQuery<{
    move_item_to_group: { id: string }
  }>(`mutation ($itemId: ID!, $groupId: String!) {
    move_item_to_group(item_id: $itemId, group_id: $groupId) { id }
  }`, { itemId, groupId }, { skipCache: true })

  clearMondayCache()
  return data.move_item_to_group
}

// ── Batch Operations ───────────────────────────────────────────────────

export async function batchCreateItems(
  boardId: string,
  groupId: string,
  items: { name: string; columnValues?: Record<string, unknown> }[]
): Promise<{ id: string; name: string }[]> {
  // Monday API doesn't have a native batch create, so we parallelize
  const results = await Promise.allSettled(
    items.map((item) => createItem(boardId, groupId, item.name, item.columnValues))
  )

  return results
    .filter((r): r is PromiseFulfilledResult<{ id: string; name: string }> => r.status === 'fulfilled')
    .map((r) => r.value)
}

export async function batchUpdateItems(
  updates: { boardId: string; itemId: string; columnValues: Record<string, unknown> }[]
): Promise<{ id: string }[]> {
  const results = await Promise.allSettled(
    updates.map((u) => updateItem(u.boardId, u.itemId, u.columnValues))
  )

  return results
    .filter((r): r is PromiseFulfilledResult<{ id: string }> => r.status === 'fulfilled')
    .map((r) => r.value)
}

export async function batchArchiveItems(itemIds: string[]): Promise<{ id: string }[]> {
  const results = await Promise.allSettled(
    itemIds.map((id) => archiveItem(id))
  )

  return results
    .filter((r): r is PromiseFulfilledResult<{ id: string }> => r.status === 'fulfilled')
    .map((r) => r.value)
}

// ── Transform items into tasks ──────────────────────────────────────────

function extractColumnValue(
  item: MondayItem,
  types: string[],
  titles: string[]
): string | null {
  const col = item.column_values.find((c) => {
    if (titles.some((t) => c.title.toLowerCase().includes(t))) return true
    return types.includes(c.type)
  })
  return col?.text || null
}

function extractDateFromColumn(
  item: MondayItem,
  titles: string[]
): string | null {
  const col = item.column_values.find((c) =>
    titles.some((t) => c.title.toLowerCase().includes(t)) &&
    (c.type === 'date' || c.type === 'timeline')
  )
  if (!col?.text) return null

  const match = col.text.match(/(\d{4}-\d{2}-\d{2})/)
  return match ? match[1] : null
}

function extractTimeline(
  item: MondayItem
): { start: string | null; end: string | null } {
  const col = item.column_values.find((c) => c.type === 'timeline')
  if (!col?.value) return { start: null, end: null }

  try {
    const parsed = JSON.parse(col.value)
    return { start: parsed.from || null, end: parsed.to || null }
  } catch {
    return { start: null, end: null }
  }
}

export function itemToTask(item: MondayItem): MondayTask {
  const mapping = _columnMapping
  const status = extractColumnValue(item, mapping.statusTypes, mapping.statusTitles)
  const dueDate = extractDateFromColumn(item, mapping.dateTitles)
  const priority = extractColumnValue(item, ['status'], mapping.priorityTitles)
  const timeline = extractTimeline(item)

  return {
    id: item.id,
    name: item.name,
    boardName: item.board.name,
    boardId: item.board.id,
    groupName: item.group.title,
    groupId: item.group.id,
    status,
    dueDate,
    assignees: item.subscribers.map((s) => ({ id: s.id, name: s.name })),
    priority,
    timelineStart: timeline.start,
    timelineEnd: timeline.end,
  }
}

export async function getAllTasks(boardIds?: string[]): Promise<MondayTask[]> {
  let ids = boardIds
  if (!ids || ids.length === 0) {
    const boards = await getBoards()
    ids = boards.map((b) => b.id)
  }

  if (ids.length === 0) return []

  const items = await getBoardItems(ids)
  return items
    .filter((item) => item.state === 'active')
    .map(itemToTask)
}
