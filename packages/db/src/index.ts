// packages/db/src/index.ts
// Exports the Prisma client as a singleton.
// All apps and packages import the client from here — never instantiate directly.

import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

// Re-export all generated types so consumers get one import
export * from '@prisma/client'

// Generated Supabase row/insert/update types — used by the Supabase JS
// client. Regenerate via the Supabase MCP `generate_typescript_types`
// or `npx supabase gen types typescript --project-id <ref>`.
export type { Database, Json } from './database.types'

// Budget operations
export { cloneBudget, topologicalAccounts } from './clone-budget'
