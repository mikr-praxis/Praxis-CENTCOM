// Monday.com configuration and capabilities documentation
// Monday.com is already configured in the MODULES array in app/api/config/route.ts
// This file documents the expanded capabilities available to the platform

export const MONDAY_CAPABILITIES = [
  // Read operations
  'taskDeadlines',
  'listBoards',
  'getBoardItems',
  'getBoardItemsPaginated',
  'getItemUpdates',
  'getUsers',
  'columnMapping',
  'cachedTasks',
  'syncStatus',
  // Write operations
  'createItem',
  'updateItem',
  'archiveItem',
  'deleteItem',
  'moveItemToGroup',
  // Batch operations
  'batchCreateItems',
  'batchUpdateItems',
  'batchArchiveItems',
  // Sync operations
  'webhookSync',
  'syncBoard',
  'syncAll',
  'clearCache',
  // Config operations
  'saveColumnMapping',
] as const

export type MondayCapability = (typeof MONDAY_CAPABILITIES)[number]

// API endpoints for Monday.com integration
export const MONDAY_API_ENDPOINTS = {
  // GET endpoints
  tasks: '/api/monday',
  boards: '/api/monday?action=boards',
  boardItems: '/api/monday?action=items&boardId=BOARD_ID',
  boardItemsPaginated: '/api/monday?action=items-paginated&boardId=BOARD_ID&limit=50&cursor=...',
  itemUpdates: '/api/monday?action=updates&itemId=ITEM_ID',
  columnMapping: '/api/monday?action=column-mapping&boardId=BOARD_ID',
  cachedTasks: '/api/monday?action=cached-tasks',
  syncStatus: '/api/monday?action=sync-status',

  // POST endpoints (action in body)
  archive: 'POST /api/monday { action: "archive", itemId }',
  delete: 'POST /api/monday { action: "delete", itemId }',
  move: 'POST /api/monday { action: "move", itemId, groupId }',
  batchArchive: 'POST /api/monday { action: "batch-archive", itemIds }',
  batchUpdate: 'POST /api/monday { action: "batch-update", updates }',
  syncBoard: 'POST /api/monday { action: "sync-board", boardId }',
  syncAll: 'POST /api/monday { action: "sync-all" }',
  clearCache: 'POST /api/monday { action: "clear-cache" }',
  saveColumnMapping: 'POST /api/monday { action: "save-column-mapping", boardId, ... }',

  // Board-specific CRUD
  createItem: 'POST /api/monday/boards { boardId, groupId, itemName, columnValues? }',

  // Webhook endpoint (called by Monday.com)
  webhook: 'POST /api/monday/webhook',
} as const
