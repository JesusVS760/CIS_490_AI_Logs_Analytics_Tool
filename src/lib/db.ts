// this updated code includes the assignment start date and end date
// As well it uses a predetermined course
// and automatic migration for older databases that don't have a start_date

import Database from "better-sqlite3";
import path from "path";
import crypto from "crypto";
import fs from "fs";
import { Session } from "@/types";

const databasePath = path.resolve(
  process.env.DATABASE_PATH ?? path.join(process.cwd(), "database.db")
);

fs.mkdirSync(path.dirname(databasePath), { recursive: true });

console.info(`[db] using sqlite file: ${databasePath}`);

const db = new Database(databasePath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

function parseTranscriptTimestamp(value?: string | null): Date | null {
  if (!value) return null;

  const match = value.match(
    /^(\d{2})\/(\d{2})\/(\d{4}),\s*(\d{2}):(\d{2}):(\d{2})\s*([AP]M)$/
  );

  if (!match) return null;

  const [, mm, dd, yyyy, hh, min, ss, ampm] = match;

  let hours = Number(hh);
  const month = Number(mm) - 1;
  const day = Number(dd);
  const year = Number(yyyy);
  const minutes = Number(min);
  const seconds = Number(ss);

  if (ampm === "AM" && hours === 12) hours = 0;
  if (ampm === "PM" && hours !== 12) hours += 12;

  const date = new Date(year, month, day, hours, minutes, seconds);

  return Number.isNaN(date.getTime()) ? null : date;
}

function parseAnyDate(value?: string | null): Date | null {
  if (!value) return null;

  const transcriptDate = parseTranscriptTimestamp(value);
  if (transcriptDate) return transcriptDate;

  const nativeDate = new Date(value);
  return Number.isNaN(nativeDate.getTime()) ? null : nativeDate;
}

function normalizeTimestamp(value?: string | null): string | null {
  const date = parseAnyDate(value);
  if (!date) return null;
  return date.toISOString();
}

function toDateOnly(value?: string | null): string | null {
  const date = parseAnyDate(value);
  if (!date) return null;
  return date.toISOString().slice(0, 10);
}

function normalizeDateOnly(value?: string | null): string | null {
  return toDateOnly(value);
}

db.exec(`
  CREATE TABLE IF NOT EXISTS instructors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    dark_mode INTEGER NOT NULL DEFAULT 0,
    profile_pic TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS instructor_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    instructor_id INTEGER NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    generated_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    anonymous_id TEXT NOT NULL UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER REFERENCES courses(id),
    name TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    start_date DATETIME,
    due_date DATETIME
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER REFERENCES students(id),
    assignment_id INTEGER REFERENCES assignments(id),
    import_key TEXT UNIQUE,
    source_file TEXT,
    started_at DATETIME,
    ended_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER REFERENCES sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK(role IN ('student', 'ai_tutor')),
    content TEXT NOT NULL,
    timestamp DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS code_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id INTEGER REFERENCES messages(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    content TEXT,
    is_empty INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS terminal_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id INTEGER REFERENCES messages(id) ON DELETE CASCADE,
    content TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

const instructorColumns = db
  .prepare("PRAGMA table_info(instructors)")
  .all() as { name: string }[];

if (!instructorColumns.some((col) => col.name === "dark_mode")) {
  db.exec(
    "ALTER TABLE instructors ADD COLUMN dark_mode INTEGER NOT NULL DEFAULT 0"
  );
}

if (!instructorColumns.some((col) => col.name === "profile_pic")) {
  db.exec("ALTER TABLE instructors ADD COLUMN profile_pic TEXT");
}

const assignmentColumns = db
  .prepare("PRAGMA table_info(assignments)")
  .all() as { name: string }[];

if (!assignmentColumns.some((col) => col.name === "start_date")) {
  db.exec("ALTER TABLE assignments ADD COLUMN start_date DATETIME");
}

if (!assignmentColumns.some((col) => col.name === "due_date")) {
  db.exec("ALTER TABLE assignments ADD COLUMN due_date DATETIME");
}

const sessionColumns = db
  .prepare("PRAGMA table_info(sessions)")
  .all() as { name: string }[];

if (!sessionColumns.some((col) => col.name === "import_key")) {
  db.exec("ALTER TABLE sessions ADD COLUMN import_key TEXT");
}

if (!sessionColumns.some((col) => col.name === "source_file")) {
  db.exec("ALTER TABLE sessions ADD COLUMN source_file TEXT");
}

db.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS idx_instructors_email_unique
  ON instructors(email);

  CREATE UNIQUE INDEX IF NOT EXISTS idx_instructor_sessions_token_unique
  ON instructor_sessions(token);

  CREATE UNIQUE INDEX IF NOT EXISTS idx_courses_name_unique
  ON courses(name);

  DROP INDEX IF EXISTS idx_assignments_course_name_unique;

  CREATE INDEX IF NOT EXISTS idx_assignments_course_name_lookup
  ON assignments(course_id, name);

  CREATE UNIQUE INDEX IF NOT EXISTS idx_assignments_course_name_dates_unique
  ON assignments(
    course_id,
    name,
    COALESCE(start_date, ''),
    COALESCE(due_date, '')
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_import_key_unique
  ON sessions(import_key);
`);

export function anonymizeId(email: string): string {
  return crypto
    .createHash("sha256")
    .update(email.toLowerCase().trim())
    .digest("hex");
}

export function buildSessionImportKey(input: {
  studentAnonymousId: string;
  assignmentId: number;
  sourceFile: string;
  startedAt?: string | null;
  endedAt?: string | null;
  firstMessage?: string | null;
  lastMessage?: string | null;
}): string {
  const raw = [
    input.studentAnonymousId,
    String(input.assignmentId),
    input.sourceFile,
    input.startedAt ?? "",
    input.endedAt ?? "",
    input.firstMessage ?? "",
    input.lastMessage ?? "",
  ].join("||");

  return crypto.createHash("sha256").update(raw).digest("hex");
}

export function upsertCourse(name: string, generatedAt?: string): number {
  db.prepare(
    `
    INSERT INTO courses (name, generated_at)
    VALUES (?, ?)
    ON CONFLICT(name) DO UPDATE SET
      generated_at = COALESCE(excluded.generated_at, courses.generated_at)
    `
  ).run(name, normalizeTimestamp(generatedAt) ?? null);

  const row = db
    .prepare("SELECT id FROM courses WHERE name = ?")
    .get(name) as { id: number };

  return row.id;
}

export function upsertStudent(rawEmail: string): number {
  const anonymousId = anonymizeId(rawEmail);

  db.prepare(
    `
    INSERT INTO students (anonymous_id)
    VALUES (?)
    ON CONFLICT(anonymous_id) DO NOTHING
    `
  ).run(anonymousId);

  const row = db
    .prepare("SELECT id FROM students WHERE anonymous_id = ?")
    .get(anonymousId) as { id: number };

  return row.id;
}

export function upsertAssignment(
  courseId: number,
  name: string,
  description?: string,
  startDate?: string,
  dueDate?: string
): number {
  const normalizedStartDate = normalizeDateOnly(startDate);
  const normalizedDueDate = normalizeDateOnly(dueDate);

  const existing = db
    .prepare(
      `
      SELECT id
      FROM assignments
      WHERE course_id = ?
        AND name = ?
        AND COALESCE(start_date, '') = COALESCE(?, '')
        AND COALESCE(due_date, '') = COALESCE(?, '')
      LIMIT 1
      `
    )
    .get(
      courseId,
      name,
      normalizedStartDate ?? null,
      normalizedDueDate ?? null
    ) as { id: number } | undefined;

  if (existing) {
    if (description && description.trim()) {
      db.prepare(
        `
        UPDATE assignments
        SET description = COALESCE(?, description)
        WHERE id = ?
        `
      ).run(description.trim(), existing.id);
    }

    return existing.id;
  }

  const result = db
    .prepare(
      `
      INSERT INTO assignments (course_id, name, description, start_date, due_date)
      VALUES (?, ?, ?, ?, ?)
      `
    )
    .run(
      courseId,
      name,
      description?.trim() || null,
      normalizedStartDate,
      normalizedDueDate
    );

  return result.lastInsertRowid as number;
}

export function createOrGetSession(params: {
  studentId: number;
  assignmentId: number;
  importKey: string;
  sourceFile?: string;
  startedAt?: string | null;
  endedAt?: string | null;
}): { id: number; inserted: boolean } {
  const insert = db.prepare(
    `
    INSERT OR IGNORE INTO sessions (
      student_id,
      assignment_id,
      import_key,
      source_file,
      started_at,
      ended_at
    )
    VALUES (?, ?, ?, ?, ?, ?)
    `
  );

  const result = insert.run(
    params.studentId,
    params.assignmentId,
    params.importKey,
    params.sourceFile ?? null,
    normalizeTimestamp(params.startedAt) ?? null,
    normalizeTimestamp(params.endedAt) ?? null
  );

  const row = db
    .prepare("SELECT id FROM sessions WHERE import_key = ?")
    .get(params.importKey) as { id: number };

  return {
    id: row.id,
    inserted: result.changes > 0,
  };
}

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
    .run(sessionId, role, content, normalizeTimestamp(timestamp) ?? null);

  return result.lastInsertRowid as number;
}

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

export const runInTransaction = db.transaction((fn: () => void) => {
  fn();
});

export function getAllSessions(): (Session & {
  messages: any[];
  workedDates: string[];
  assignmentName?: string | null;
  assignmentStartDate?: string | null;
  assignmentDueDate?: string | null;
})[] {
  const sessions = db
    .prepare(
      `
      SELECT
        s.id,
        s.student_id AS studentId,
        s.assignment_id AS assignmentId,
        s.started_at AS startedAt,
        s.ended_at AS endedAt,
        s.created_at AS createdAt,
        a.name AS assignmentName,
        a.start_date AS assignmentStartDate,
        a.due_date AS assignmentDueDate
      FROM sessions s
      LEFT JOIN assignments a ON s.assignment_id = a.id
      ORDER BY COALESCE(s.started_at, s.created_at) ASC, s.id ASC
      `
    )
    .all() as (Session & {
    assignmentName?: string | null;
    assignmentStartDate?: string | null;
    assignmentDueDate?: string | null;
  })[];

  return sessions.map((session) => {
    const messages = db
      .prepare(
        `
        SELECT
          id,
          role,
          content,
          timestamp
        FROM messages
        WHERE session_id = ?
        ORDER BY COALESCE(timestamp, created_at) ASC, id ASC
        `
      )
      .all(session.id) as any[];

    const workedDates = Array.from(
      new Set(
        messages
          .map((message) => toDateOnly(message.timestamp))
          .filter((value): value is string => Boolean(value))
      )
    ).sort();

    return {
      ...session,
      messages,
      workedDates,
    };
  });
}

export function getAllMessages() {
  const rows = db
    .prepare(
      `
      SELECT
        m.id,
        m.content,
        m.role,
        m.timestamp,
        m.session_id AS sessionId,
        s.student_id AS studentId,
        s.assignment_id AS assignmentId,
        st.anonymous_id AS studentAnonymousId,
        a.name AS assignmentName,
        a.start_date AS assignmentStartDate,
        a.due_date AS assignmentDueDate
      FROM messages m
      JOIN sessions s ON m.session_id = s.id
      JOIN students st ON s.student_id = st.id
      JOIN assignments a ON s.assignment_id = a.id
      ORDER BY COALESCE(m.timestamp, m.created_at) ASC, m.id ASC
      `
    )
    .all() as any[];

  return rows.map((row) => ({
    ...row,
    workedDate: toDateOnly(row.timestamp),
  }));
}

export function getAllAssignments() {
  return db
    .prepare(
      `
      SELECT
        id,
        course_id AS courseId,
        name,
        description,
        start_date AS startDate,
        due_date AS dueDate,
        created_at AS createdAt
      FROM assignments
      ORDER BY created_at DESC, id DESC
      `
    )
    .all();
}
export function getUserCountsPerAssignment() {
  return db
    .prepare(
      `
      SELECT
        a.id AS assignmentId,
        a.name AS assignmentName,
        COUNT(DISTINCT s.student_id) AS userCount
      FROM assignments a
      LEFT JOIN sessions s ON s.assignment_id = a.id
      GROUP BY a.id, a.name
      ORDER BY a.created_at ASC, a.id ASC
      `
    )
    .all() as {
      assignmentId: number;
      assignmentName: string;
      userCount: number;
    }[];
}


export default db;