// Updated db.ts — uses @libsql/client for both local SQLite and Turso (Vercel)
// Local:  set DATABASE_PATH=./database.db  (uses file: protocol via libsql)
// Vercel: set TURSO_DATABASE_URL + TURSO_AUTH_TOKEN  (uses libsql remote)
//
// Key change from better-sqlite3: all queries are now async/await.
// db.prepare().get()  →  (await db.execute()).rows[0]
// db.prepare().all()  →  (await db.execute()).rows
// db.prepare().run()  →  await db.execute()
// db.transaction()    →  await db.batch()

import { createClient } from "@libsql/client";
import path from "path";
import crypto from "crypto";
import { Session } from "@/types";

function createDb() {
  // Vercel/production: use Turso remote database
  if (process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN) {
    return createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }

  // Local: use SQLite file via libsql (same driver, file:// protocol)
  const dbPath = path.resolve(
    process.env.DATABASE_PATH ?? path.join(process.cwd(), "database.db"),
  );
  console.info(`[db] using sqlite file: ${dbPath}`);
  return createClient({ url: `file:${dbPath}` });
}

const db = createDb();

// ---------------------------------------------------------------------------
// Schema bootstrap
// ---------------------------------------------------------------------------

export async function initializeDb(): Promise<void> {
  await db.executeMultiple(`
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
      anonymous_id TEXT NOT NULL,
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

  // --- Migrations: add columns if they don't exist ---
  // libsql doesn't support PRAGMA table_info the same way, so we use
  // ALTER TABLE IF NOT EXISTS (supported in SQLite 3.37+ and libsql).
  // These are safe to run repeatedly — they no-op if column already exists.
  const alterStatements = [
    `ALTER TABLE instructors ADD COLUMN dark_mode INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE instructors ADD COLUMN profile_pic TEXT`,
    `ALTER TABLE instructors ADD COLUMN auth_provider TEXT NOT NULL DEFAULT 'local'`,
    `ALTER TABLE instructors ADD COLUMN github_id TEXT`,
    `ALTER TABLE instructors ADD COLUMN has_local_password INTEGER NOT NULL DEFAULT 1`,
    `ALTER TABLE instructors ADD COLUMN is_verified INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE instructors ADD COLUMN verification_code TEXT`,
    `ALTER TABLE instructors ADD COLUMN verification_expires TEXT`,
    `ALTER TABLE instructors ADD COLUMN reset_code TEXT`,
    `ALTER TABLE instructors ADD COLUMN reset_expires TEXT`,
    `ALTER TABLE assignments ADD COLUMN start_date DATETIME`,
    `ALTER TABLE assignments ADD COLUMN due_date DATETIME`,
    `ALTER TABLE sessions ADD COLUMN import_key TEXT`,
    `ALTER TABLE sessions ADD COLUMN source_file TEXT`,
    `ALTER TABLE courses ADD COLUMN instructor_id INTEGER REFERENCES instructors(id) ON DELETE CASCADE`,
    `ALTER TABLE students ADD COLUMN instructor_id INTEGER REFERENCES instructors(id) ON DELETE CASCADE`,
    `ALTER TABLE assignments ADD COLUMN instructor_id INTEGER REFERENCES instructors(id) ON DELETE CASCADE`,
    `ALTER TABLE sessions ADD COLUMN instructor_id INTEGER REFERENCES instructors(id) ON DELETE CASCADE`,
  ];

  for (const sql of alterStatements) {
    try {
      await db.execute(sql);
    } catch {
      // Column already exists — safe to ignore
    }
  }

  // --- Indexes ---
  await db.executeMultiple(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_instructors_email_unique
      ON instructors(email);

    CREATE UNIQUE INDEX IF NOT EXISTS idx_instructor_sessions_token_unique
      ON instructor_sessions(token);

    DROP INDEX IF EXISTS idx_courses_name_unique;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_courses_instructor_name_unique
      ON courses(instructor_id, name);

    DROP INDEX IF EXISTS idx_assignments_course_name_unique;
    CREATE INDEX IF NOT EXISTS idx_assignments_course_name_lookup
      ON assignments(course_id, name);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_assignments_instructor_course_name_unique
      ON assignments(instructor_id, course_id, name);

    CREATE UNIQUE INDEX IF NOT EXISTS idx_students_instructor_anon_unique
      ON students(instructor_id, anonymous_id);

    CREATE UNIQUE INDEX IF NOT EXISTS idx_instructors_github_id
      ON instructors(github_id)
      WHERE github_id IS NOT NULL;

    CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_import_key_unique
      ON sessions(import_key);
  `);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseTranscriptTimestamp(value?: string | null): Date | null {
  if (!value) return null;
  const match = value.match(
    /^(\d{2})\/(\d{2})\/(\d{4}),\s*(\d{2}):(\d{2}):(\d{2})\s*([AP]M)$/,
  );
  if (!match) return null;
  const [, mm, dd, yyyy, hh, min, ss, ampm] = match;
  let hours = Number(hh);
  if (ampm === "AM" && hours === 12) hours = 0;
  if (ampm === "PM" && hours !== 12) hours += 12;
  const date = new Date(
    Number(yyyy),
    Number(mm) - 1,
    Number(dd),
    hours,
    Number(min),
    Number(ss),
  );
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
  return date ? date.toISOString() : null;
}

function toDateOnly(value?: string | null): string | null {
  const date = parseAnyDate(value);
  return date ? date.toISOString().slice(0, 10) : null;
}

function normalizeDateOnly(value?: string | null): string | null {
  return toDateOnly(value);
}

// libsql returns row values as an array — this maps them to a plain object
// using the column names from the ResultSet.
function rowsAsObjects(result: Awaited<ReturnType<typeof db.execute>>) {
  const cols = result.columns;
  return result.rows.map((row) => {
    const obj: Record<string, unknown> = {};
    cols.forEach((col, i) => {
      obj[col] = row[i];
    });
    return obj;
  });
}

// ---------------------------------------------------------------------------
// Public API — all functions are now async
// ---------------------------------------------------------------------------

export function anonymizeId(email: string): string {
  return crypto
    .createHash("sha256")
    .update(email.toLowerCase().trim())
    .digest("hex");
}

export function buildSessionImportKey(input: {
  instructorId: number;
  studentAnonymousId: string;
  assignmentId: number;
  sourceFile: string;
  startedAt?: string | null;
  endedAt?: string | null;
  firstMessage?: string | null;
  lastMessage?: string | null;
}): string {
  const raw = [
    String(input.instructorId),
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

export async function upsertCourse(
  instructorId: number,
  name: string,
  generatedAt?: string,
): Promise<number> {
  await db.execute({
    sql: `
      INSERT INTO courses (instructor_id, name, generated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(instructor_id, name) DO UPDATE SET
        generated_at = COALESCE(excluded.generated_at, courses.generated_at)
    `,
    args: [instructorId, name, normalizeTimestamp(generatedAt) ?? null],
  });

  const result = await db.execute({
    sql: "SELECT id FROM courses WHERE instructor_id = ? AND name = ?",
    args: [instructorId, name],
  });

  return rowsAsObjects(result)[0].id as number;
}

export async function upsertStudent(
  instructorId: number,
  rawEmail: string,
): Promise<number> {
  const anonymousId = anonymizeId(rawEmail);

  await db.execute({
    sql: `
      INSERT INTO students (instructor_id, anonymous_id)
      VALUES (?, ?)
      ON CONFLICT(instructor_id, anonymous_id) DO NOTHING
    `,
    args: [instructorId, anonymousId],
  });

  const result = await db.execute({
    sql: "SELECT id FROM students WHERE instructor_id = ? AND anonymous_id = ?",
    args: [instructorId, anonymousId],
  });

  return rowsAsObjects(result)[0].id as number;
}

export async function upsertAssignment(
  instructorId: number,
  courseId: number,
  name: string,
  description?: string,
  startDate?: string,
  dueDate?: string,
): Promise<number> {
  const normalizedStartDate = normalizeDateOnly(startDate);
  const normalizedDueDate = normalizeDateOnly(dueDate);

  const existingResult = await db.execute({
    sql: `SELECT id FROM assignments
          WHERE instructor_id = ? AND course_id = ? AND name = ? LIMIT 1`,
    args: [instructorId, courseId, name],
  });

  const existing = rowsAsObjects(existingResult)[0] as
    | { id: number }
    | undefined;

  if (existing) {
    await db.execute({
      sql: `
        UPDATE assignments
        SET start_date = COALESCE(?, start_date),
            due_date = COALESCE(?, due_date),
            description = COALESCE(?, description)
        WHERE id = ?
      `,
      args: [
        normalizedStartDate ?? null,
        normalizedDueDate ?? null,
        description?.trim() || null,
        existing.id,
      ],
    });
    return existing.id;
  }

  const result = await db.execute({
    sql: `INSERT INTO assignments (instructor_id, course_id, name, description, start_date, due_date)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [
      instructorId,
      courseId,
      name,
      description?.trim() || null,
      normalizedStartDate,
      normalizedDueDate,
    ],
  });

  return Number(result.lastInsertRowid);
}

export async function createOrGetSession(params: {
  instructorId: number;
  studentId: number;
  assignmentId: number;
  importKey: string;
  sourceFile?: string;
  startedAt?: string | null;
  endedAt?: string | null;
}): Promise<{ id: number; inserted: boolean }> {
  const result = await db.execute({
    sql: `
      INSERT OR IGNORE INTO sessions (
        instructor_id, student_id, assignment_id,
        import_key, source_file, started_at, ended_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    args: [
      params.instructorId,
      params.studentId,
      params.assignmentId,
      params.importKey,
      params.sourceFile ?? null,
      normalizeTimestamp(params.startedAt) ?? null,
      normalizeTimestamp(params.endedAt) ?? null,
    ],
  });

  const row = await db.execute({
    sql: "SELECT id FROM sessions WHERE import_key = ?",
    args: [params.importKey],
  });

  return {
    id: rowsAsObjects(row)[0].id as number,
    inserted: result.rowsAffected > 0,
  };
}

export async function createMessage(
  sessionId: number,
  role: "student" | "ai_tutor",
  content: string,
  timestamp?: string,
): Promise<number> {
  const result = await db.execute({
    sql: "INSERT INTO messages (session_id, role, content, timestamp) VALUES (?, ?, ?, ?)",
    args: [sessionId, role, content, normalizeTimestamp(timestamp) ?? null],
  });
  return Number(result.lastInsertRowid);
}

export async function createCodeSnapshot(
  messageId: number,
  filename: string,
  content: string | null,
  isEmpty: boolean,
): Promise<number> {
  const result = await db.execute({
    sql: "INSERT INTO code_snapshots (message_id, filename, content, is_empty) VALUES (?, ?, ?, ?)",
    args: [messageId, filename, content ?? null, isEmpty ? 1 : 0],
  });
  return Number(result.lastInsertRowid);
}

export async function createTerminalSnapshot(
  messageId: number,
  content: string,
): Promise<number> {
  const result = await db.execute({
    sql: "INSERT INTO terminal_snapshots (message_id, content) VALUES (?, ?)",
    args: [messageId, content],
  });
  return Number(result.lastInsertRowid);
}

export async function runInTransaction(fn: () => Promise<void>): Promise<void> {
  await fn();
}

export async function getSessionsByInstructor(instructorId: number): Promise<
  (Session & {
    messages: any[];
    workedDates: string[];
    assignmentName?: string | null;
    assignmentStartDate?: string | null;
    assignmentDueDate?: string | null;
  })[]
> {
  const sessionsResult = await db.execute({
    sql: `
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
      WHERE s.instructor_id = ?
      ORDER BY COALESCE(s.started_at, s.created_at) ASC, s.id ASC
    `,
    args: [instructorId],
  });

  const sessions = rowsAsObjects(sessionsResult) as (Session & {
    assignmentName?: string | null;
    assignmentStartDate?: string | null;
    assignmentDueDate?: string | null;
  })[];

  return Promise.all(
    sessions.map(async (session) => {
      const messagesResult = await db.execute({
        sql: `
          SELECT id, role, content, timestamp
          FROM messages
          WHERE session_id = ?
          ORDER BY COALESCE(timestamp, created_at) ASC, id ASC
        `,
        args: [session.id as number],
      });

      const messages = rowsAsObjects(messagesResult) as any[];

      const workedDates = Array.from(
        new Set(
          messages
            .map((m) => toDateOnly(m.timestamp as string | null))
            .filter((v): v is string => Boolean(v)),
        ),
      ).sort();

      return { ...session, messages, workedDates };
    }),
  );
}

export async function getMessagesByInstructor(instructorId: number) {
  const result = await db.execute({
    sql: `
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
      WHERE s.instructor_id = ?
      ORDER BY COALESCE(m.timestamp, m.created_at) ASC, m.id ASC
    `,
    args: [instructorId],
  });

  return rowsAsObjects(result).map((row) => ({
    ...row,
    workedDate: toDateOnly(row.timestamp as string | null),
  }));
}

export async function getAssignmentsByInstructor(instructorId: number) {
  const result = await db.execute({
    sql: `
      SELECT
        id,
        course_id AS courseId,
        name,
        description,
        start_date AS startDate,
        due_date AS dueDate,
        created_at AS createdAt
      FROM assignments
      WHERE instructor_id = ?
      ORDER BY created_at DESC, id DESC
    `,
    args: [instructorId],
  });
  return rowsAsObjects(result);
}

export async function getUserCountsPerAssignmentByInstructor(
  instructorId: number,
) {
  const result = await db.execute({
    sql: `
      SELECT
        a.id AS assignmentId,
        a.name AS assignmentName,
        COUNT(DISTINCT s.student_id) AS userCount
      FROM assignments a
      LEFT JOIN sessions s ON s.assignment_id = a.id
      WHERE a.instructor_id = ?
      GROUP BY a.id, a.name
      ORDER BY a.created_at ASC, a.id ASC
    `,
    args: [instructorId],
  });
  return rowsAsObjects(result) as {
    assignmentId: number;
    assignmentName: string;
    userCount: number;
  }[];
}

export default db;
