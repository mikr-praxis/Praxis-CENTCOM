// Monday.com GraphQL API client
// Docs: https://developer.monday.com/api-reference

import { getConfig } from '@/lib/config'

const MONDAY_API_URL = 'https://api.monday.com/v2'

async function getToken() {
  const token = await getConfig('MONDAY_API_KEY')
  if (!token) throw new Error('MONDAY_API_KEY is not set. Configure it at /config.')
  return token
}

export async function mondayQuery<T = Record<string, unknown>>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const token = await getToken()
  const res = await fetch(MONDAY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: token,
      'API-Version': '2024-10',
    },
    body: JSON.stringify({ query, variables }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Monday.com API error ${res.status}: ${text}`)
  }

  const json = await res.json()
  if (json.errors) {
    throw new Error(`Monday.com GraphQL errors: ${JSON.stringify(json.errors)}`)
  }

  return json.data as T
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
  groupName: string
  status: string | null
  dueDate: string | null       // ISO date string
  assignees: { id: string; name: string }[]
  priority: string | null
  timelineStart: string | null // ISO date string
  timelineEnd: string | null   // ISO date string
}

// ── Queries ─────────────────────────────────────────────────────────────

export async function getBoards(): Promise<{ id: string; name: string }[]> {
  const data = await mondayQuery<{
    boards: { id: string; name: string }[]
  }>(`query { boards(limit: 50) { id name } }`)

  return data.boards
}

export async function getBoardItems(boardIds: string[]): Promise<MondayItem[]> {
  const data = await mondayQuery<{
    boards: {
      items_page: {
        items: MondayItem[]
      }
    }[]
  }>(`query ($ids: [ID!]!) {
    boards(ids: $ids) {
      items_page(limit: 200) {
        items {
          id
          name
          state
          board { id name }
          group { id title }
          column_values {
            id
            title
            text
            type
            value
          }
          subscribers {
            id
            name
          }
        }
      }
    }
  }`, { ids: boardIds })

  return data.boards.flatMap((b) => b.items_page.items)
}

export async function getUsers(): Promise<MondayUser[]> {
  const data = await mondayQuery<{
    users: MondayUser[]
  }>(`query {
    users(limit: 50) {
      id
      name
      email
      photo_thumb_small
    }
  }`)

  return data.users
}

// ── Transform items into tasks ──────────────────────────────────────────

function extractColumnValue(
  item: MondayItem,
  types: string[],
  titles?: string[]
): string | null {
  const col = item.column_values.find((c) => {
    if (titles && titles.some((t) => c.title.toLowerCase().includes(t))) return true
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

  // Monday date columns return "YYYY-MM-DD" or timeline returns "YYYY-MM-DD - YYYY-MM-DD"
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
  const status = extractColumnValue(item, ['status'], ['status'])
  const dueDate = extractDateFromColumn(item, ['due', 'date', 'deadline'])
  const priority = extractColumnValue(item, ['status'], ['priority'])
  const timeline = extractTimeline(item)

  return {
    id: item.id,
    name: item.name,
    boardName: item.board.name,
    groupName: item.group.title,
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

// ── Expanded API functions ──────────────────────────────────────────────────

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

export async function listBoards(): Promise<MondayBoard[]> {
  const data = await mondayQuery<{
    boards: MondayBoard[]
  }>(`query {
    boards(limit: 50) {
      id
      name
      board_kind
      state
      columns {
        id
        title
        type
      }
    }
  }`)

  return data.boards
}

export async function getBoardItemsById(boardId: string, limit?: number): Promise<MondayItem[]> {
  const queryLimit = limit || 200
  const data = await mondayQuery<{
    boards: {
      items_page: {
        items: MondayItem[]
      }
    }[]
  }>(`query ($id: ID!, $limit: Int!) {
    boards(ids: [$id]) {
      items_page(limit: $limit) {
        items {
          id
          name
          state
          board { id name }
          group { id title }
          column_values {
            id
            title
            text
            type
            value
          }
          subscribers {
            id
            name
          }
        }
      }
    }
  }`, { id: boardId, limit: queryLimit })

  return data.boards[0]?.items_page.items || []
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

export async function getItemUpdates(itemId: string, limit?: number): Promise<MondayUpdate[]> {
  const queryLimit = limit || 50
  const data = await mondayQuery<{
    items: {
      updates: MondayUpdate[]
    }[]
  }>(`query ($id: [ID!]!, $limit: Int!) {
    items(ids: [$id]) {
      updates(limit: $limit) {
        id
        text_body
        creator {
          id
          name
        }
        created_at
      }
    }
  }`, { id: [itemId], limit: queryLimit })

  return data.items[0]?.updates || []
}

export async function createItem(
  boardId: string,
  groupId: string,
  itemName: string,
  columnValues?: Record<string, unknown>
): Promise<{ id: string; name: string }> {
  // Prepare column values JSON
  const columnValuesJson = columnValues
    ? JSON.stringify(columnValues)
    : '{}'

  const data = await mondayQuery<{
    create_item: {
      id: string
      name: string
    }
  }>(`mutation ($boardId: ID!, $groupId: String!, $itemName: String!, $columnValues: JSON) {
    create_item(
      board_id: $boardId
      group_id: $groupId
      item_name: $itemName
      column_values: $columnValues
    ) {
      id
      name
    }
  }`, {
    boardId,
    groupId,
    itemName,
    columnValues: columnValuesJson,
  })

  return data.create_item
}

export async function updateItem(
  boardId: string,
  itemId: string,
  columnValues: Record<string, unknown>
): Promise<{ id: string }> {
  const columnValuesJson = JSON.stringify(columnValues)

  const data = await mondayQuery<{
    update_item_column_values: {
      id: string
    }
  }>(`mutation ($boardId: ID!, $itemId: ID!, $columnValues: JSON) {
    update_item_column_values(
      board_id: $boardId
      item_id: $itemId
      column_values: $columnValues
    ) {
      id
    }
  }`, {
    boardId,
    itemId,
    columnValues: columnValuesJson,
  })

  return data.update_item_column_values
}
