import db from "@/lib/db";

export function ensureInstructorsTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS instructors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      auth_provider TEXT NOT NULL DEFAULT 'local',
      github_id TEXT,
      has_local_password INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const instructorColumns = db
    .prepare("PRAGMA table_info(instructors)")
    .all() as { name: string }[];

  if (!instructorColumns.some((col) => col.name === "auth_provider")) {
    db.exec(
      "ALTER TABLE instructors ADD COLUMN auth_provider TEXT NOT NULL DEFAULT 'local'",
    );
  }

  if (!instructorColumns.some((col) => col.name === "github_id")) {
    db.exec("ALTER TABLE instructors ADD COLUMN github_id TEXT");
  }

  if (!instructorColumns.some((col) => col.name === "has_local_password")) {
    db.exec(
      "ALTER TABLE instructors ADD COLUMN has_local_password INTEGER NOT NULL DEFAULT 1",
    );
  }

  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_instructors_github_id
    ON instructors(github_id)
    WHERE github_id IS NOT NULL
  `);
}
