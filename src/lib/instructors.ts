// All table creation and migrations are now handled by initializeDb() in db.ts,
// which is called once on startup from layout.tsx.
// This file is kept for import compatibility but ensureInstructorsTable is a no-op.

export function ensureInstructorsTable() {
  // No-op: schema is managed by initializeDb() in @/lib/db
}
