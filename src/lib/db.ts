//this updated code includes the assignment start date and end date
// As well it uses a predetermined course 
// and automatic migration for older databases that don't have a start_date


import Database from "better-sqlite3";
import path from "path";
import crypto from "crypto";

const db = new Database(path.join(process.cwd(), "database.db"));
db.pragma("journal_mode = WAL");

db.exec(`
  -- Each course that uploads transcripts
  CREATE TABLE IF NOT EXISTS courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    generated_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Each unique student (no PII stored)
  CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    anonymous_id TEXT NOT NULL UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Each assignment (e.g. HWK1) within a course
  CREATE TABLE IF NOT EXISTS assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER REFERENCES courses(id),
    name TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    start_date DATETIME,
    due_date DATETIME
  );

  -- Each student's session on a given assignment
  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER REFERENCES students(id),
    assignment_id INTEGER REFERENCES assignments(id),
    started_at DATETIME,
    ended_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Every message exchanged in a session
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER REFERENCES sessions(id),
    role TEXT NOT NULL CHECK(role IN ('student', 'ai_tutor')),
    content TEXT NOT NULL,
    timestamp DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Snapshot of student's code file at each message
  CREATE TABLE IF NOT EXISTS code_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id INTEGER REFERENCES messages(id),
    filename TEXT NOT NULL,
    content TEXT,
    is_empty INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Terminal output captured at each message
  CREATE TABLE IF NOT EXISTS terminal_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id INTEGER REFERENCES messages(id),
    content TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Migrate older databases safely
const assignmentColumns = db
  .prepare("PRAGMA table_info(assignments)")
  .all() as { name: string }[];

if (!assignmentColumns.some((col) => col.name === "start_date")) {
  db.exec("ALTER TABLE assignments ADD COLUMN start_date DATETIME");
}

if (!assignmentColumns.some((col) => col.name === "due_date")) {
  db.exec("ALTER TABLE assignments ADD COLUMN due_date DATETIME");
}

// Anonymize student identifiers before storing — never store raw emails
export function anonymizeId(email: string): string {
  return crypto
    .createHash("sha256")
    .update(email.toLowerCase().trim())
    .digest("hex");
}

// ─── Courses ────────────────────────────────────────────────────────────────

export function upsertCourse(name: string, generatedAt?: string): number {
  const existing = db
    .prepare("SELECT id FROM courses WHERE name = ?")
    .get(name) as { id: number } | undefined;

  if (existing) return existing.id;

  const result = db
    .prepare("INSERT INTO courses (name, generated_at) VALUES (?, ?)")
    .run(name, generatedAt ?? null);

  return result.lastInsertRowid as number;
}

// ─── Students ───────────────────────────────────────────────────────────────

export function upsertStudent(rawEmail: string): number {
  const anonymousId = anonymizeId(rawEmail);

  const existing = db
    .prepare("SELECT id FROM students WHERE anonymous_id = ?")
    .get(anonymousId) as { id: number } | undefined;

  if (existing) return existing.id;

  const result = db
    .prepare("INSERT INTO students (anonymous_id) VALUES (?)")
    .run(anonymousId);

  return result.lastInsertRowid as number;
}

// ─── Assignments ─────────────────────────────────────────────────────────────

export function upsertAssignment(
  courseId: number,
  name: string,
  description?: string,
  startDate?: string,
  dueDate?: string
): number {
  const existing = db
    .prepare("SELECT id FROM assignments WHERE course_id = ? AND name = ?")
    .get(courseId, name) as { id: number } | undefined;

  if (existing) {
    db.prepare(`
      UPDATE assignments
      SET description = ?,
          start_date = ?,
          due_date = ?
      WHERE id = ?
    `).run(description ?? null, startDate ?? null, dueDate ?? null, existing.id);

    return existing.id;
  }

  const result = db
    .prepare(`
      INSERT INTO assignments (course_id, name, description, start_date, due_date)
      VALUES (?, ?, ?, ?, ?)
    `)
    .run(
      courseId,
      name,
      description ?? null,
      startDate ?? null,
      dueDate ?? null
    );

  return result.lastInsertRowid as number;
}

// ─── Sessions ────────────────────────────────────────────────────────────────

export function createSession(
  studentId: number,
  assignmentId: number,
  startedAt?: string,
  endedAt?: string
): number {
  const result = db
    .prepare(
      "INSERT INTO sessions (student_id, assignment_id, started_at, ended_at) VALUES (?, ?, ?, ?)"
    )
    .run(studentId, assignmentId, startedAt ?? null, endedAt ?? null);

  return result.lastInsertRowid as number;
}

// ─── Messages ────────────────────────────────────────────────────────────────

export function createMessage(
  sessionId: number,
  role: "student" | "ai_tutor",
  content: string,
  timestamp?: string
): number {
  const result = db
    .prepare(
      "INSERT INTO messages (session_id, role, content, timestamp) VALUES (?, ?, ?, ?)"
    )
    .run(sessionId, role, content, timestamp ?? null);

  return result.lastInsertRowid as number;
}

// ─── Code Snapshots ──────────────────────────────────────────────────────────

export function createCodeSnapshot(
  messageId: number,
  filename: string,
  content: string | null,
  isEmpty: boolean
): number {
  const result = db
    .prepare(
      "INSERT INTO code_snapshots (message_id, filename, content, is_empty) VALUES (?, ?, ?, ?)"
    )
    .run(messageId, filename, content ?? null, isEmpty ? 1 : 0);

  return result.lastInsertRowid as number;
}

// ─── Terminal Snapshots ──────────────────────────────────────────────────────

export function createTerminalSnapshot(
  messageId: number,
  content: string
): number {
  const result = db
    .prepare(
      "INSERT INTO terminal_snapshots (message_id, content) VALUES (?, ?)"
    )
    .run(messageId, content);

  return result.lastInsertRowid as number;
}

export function getAllSessions() {
  return db
    .prepare(`
      SELECT 
        id,
        started_at as startedAt,
        ended_at as endedAt
      FROM sessions
    `)
    .all();
}

export function getAllMessages() {
  return db
    .prepare(`
      SELECT content
      FROM messages
      WHERE role = 'student'
    `)
    .all();
}

export function getAllAssignments() {
  return db
    .prepare(`
      SELECT
        id,
        course_id as courseId,
        name,
        description,
        start_date as startDate,
        due_date as dueDate,
        created_at as createdAt
      FROM assignments
      ORDER BY created_at DESC
    `)
    .all();
}

export default db;