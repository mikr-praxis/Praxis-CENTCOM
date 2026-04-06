// Monday.com configuration and capabilities documentation
// Monday.com is already configured in the MODULES array in app/api/config/route.ts
// This file documents the expanded capabilities available to the platform

export const MONDAY_CAPABILITIES = [
  // Original capability
  'taskDeadlines',
  // New expanded capabilities
  'listBoards',
  'getBoardItems',
  'getItemUpdates',
  'createItem',
  'updateItem',
] as const

export type MondayCapability = (typeof MONDAY_CAPABILITIES)[number]

// API endpoints for Monday.com integration
export const MONDAY_API_ENDPOINTS = {
  // Backward-compatible task deadline fetching
  tasks: '/api/monday?boardIds=id1,id2',

  // New board management endpoints
  listAllBoards: '/api/monday?action=boards',
  getBoardItems: '/api/monday?action=items&boardId=BOARD_ID&limit=200',
  getItemUpdates: '/api/monday?action=updates&itemId=ITEM_ID&limit=50',

  // Board-specific operations
  boards: {
    list: '/api/monday/boards',
    createItem: '/api/monday/boards',
  },
} as const

// Documentation: Monday.com GraphQL API types
// These types are defined in lib/monday/client.ts
// - MondayBoard: board metadata including columns
// - MondayItem: item/task with column values
// - MondayUpdate: item updates/comments
// - MondayTask: transformed item for task/deadline display

// Configuration is managed via /config page
// The MONDAY_API_KEY must be set before using any Monday functions
