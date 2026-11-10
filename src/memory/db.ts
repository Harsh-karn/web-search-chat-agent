import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";

let dbInstance: DatabaseSync | null = null;

export interface MessageRecord {
  id: string;
  user_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface SourceRecord {
  id: string;
  message_id: string;
  url: string;
  title: string;
  published_at?: string | null;
  snippet?: string | null;
  retrieved_at?: string | null;
}

export function getDb(): DatabaseSync {
  if (dbInstance) {
    return dbInstance;
  }

  const dbPath = process.env.DATABASE_PATH || "./data/chat.db";
  const resolvedDir = path.dirname(path.resolve(dbPath));

  if (!fs.existsSync(resolvedDir)) {
    fs.mkdirSync(resolvedDir, { recursive: true });
  }

  dbInstance = new DatabaseSync(dbPath);
  dbInstance.exec("PRAGMA journal_mode = WAL;");
  dbInstance.exec("PRAGMA foreign_keys = ON;");

  dbInstance.exec("PRAGMA busy_timeout = 2000;");
  initSchema(dbInstance);
  const columns = dbInstance
    .prepare("PRAGMA table_info(answer_sources)")
    .all() as unknown as { name: string }[];
  for (const name of ["snippet", "retrieved_at"])
    if (!columns.some((c) => c.name === name))
      dbInstance.exec(`ALTER TABLE answer_sources ADD COLUMN ${name} TEXT`);
  const messageColumns = dbInstance
    .prepare("PRAGMA table_info(messages)")
    .all() as unknown as { name: string }[];
  if (!messageColumns.some((c) => c.name === "status"))
    dbInstance.exec(
      "ALTER TABLE messages ADD COLUMN status TEXT NOT NULL DEFAULT 'completed'",
    );
  return dbInstance;
}

function initSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      timezone TEXT
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_messages_user_created 
      ON messages(user_id, created_at);

    CREATE TABLE IF NOT EXISTS answer_sources (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL,
      url TEXT NOT NULL,
      title TEXT NOT NULL,
      published_at TEXT,
      FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_sources_message_id 
      ON answer_sources(message_id);
  `);
}

export function ensureUser(userId: string, timezone?: string): void {
  const db = getDb();
  const existing = db
    .prepare("SELECT id, timezone FROM users WHERE id = ?")
    .get(userId) as { id: string; timezone: string | null } | undefined;

  if (!existing) {
    db.prepare(
      `
      INSERT INTO users (id, created_at, timezone)
      VALUES (?, ?, ?)
    `,
    ).run(userId, new Date().toISOString(), timezone || null);
  } else if (timezone && timezone !== existing.timezone) {
    db.prepare(`UPDATE users SET timezone = ? WHERE id = ?`).run(
      timezone,
      userId,
    );
  }
}

export function getUserTimezone(userId: string): string | null {
  const db = getDb();
  const user = db
    .prepare("SELECT timezone FROM users WHERE id = ?")
    .get(userId) as { timezone: string | null } | undefined;
  return user?.timezone || null;
}

export function saveMessage(msg: {
  id: string;
  userId: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
  status?: "pending" | "completed" | "failed";
}): void {
  const db = getDb();
  ensureUser(msg.userId);

  const createdAt = msg.createdAt || new Date().toISOString();
  db.prepare(
    `
    INSERT INTO messages (id, user_id, role, content, created_at, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `,
  ).run(
    msg.id,
    msg.userId,
    msg.role,
    msg.content,
    createdAt,
    msg.status || "completed",
  );
}

export function saveSources(
  sources: Array<{
    id?: string;
    messageId: string;
    url: string;
    title: string;
    publishedAt?: string | null;
    snippet?: string;
    retrievedAt?: string;
  }>,
): void {
  if (sources.length === 0) return;
  const db = getDb();

  const insert = db.prepare(`
    INSERT INTO answer_sources (id, message_id, url, title, published_at, snippet, retrieved_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (const row of sources) {
    const id =
      row.id || `src_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    insert.run(
      id,
      row.messageId,
      row.url,
      row.title,
      row.publishedAt || null,
      row.snippet || null,
      row.retrievedAt || null,
    );
  }
}

export function getMessagesByDateRange(
  userId: string,
  startIso: string,
  endIso: string,
): MessageRecord[] {
  const db = getDb();
  const rows = db
    .prepare(
      `
    SELECT id, user_id, role, content, created_at
    FROM messages
    WHERE (user_id = ? OR user_id LIKE ?) AND status = 'completed' AND created_at >= ? AND created_at <= ?
    ORDER BY created_at DESC LIMIT 40
  `,
    )
    .all(userId, recallScope(userId), startIso, endIso);
  return (rows as unknown as MessageRecord[]).sort((a, b) =>
    a.created_at.localeCompare(b.created_at),
  );
}

export function getMessagesByKeyword(
  userId: string,
  keyword: string,
  limit: number = 10,
): MessageRecord[] {
  const db = getDb();
  const rows = db
    .prepare(
      `
    SELECT id, user_id, role, content, created_at
    FROM messages
    WHERE (user_id = ? OR user_id LIKE ?) AND status = 'completed' AND content LIKE ?
    ORDER BY created_at DESC
    LIMIT ?
  `,
    )
    .all(userId, recallScope(userId), `%${keyword}%`, limit);
  return (rows as unknown as MessageRecord[]).sort((a, b) =>
    a.created_at.localeCompare(b.created_at),
  );
}

export function getSourcesForMessage(messageId: string): SourceRecord[] {
  const db = getDb();
  const rows = db
    .prepare(
      `
    SELECT id, message_id, url, title, published_at, snippet, retrieved_at
    FROM answer_sources
    WHERE message_id = ?
  `,
    )
    .all(messageId);
  return rows as unknown as SourceRecord[];
}

export function getRecentMessages(
  userId: string,
  limit: number = 20,
): MessageRecord[] {
  const db = getDb();
  const rows = db
    .prepare(
      `
    SELECT id, user_id, role, content, created_at
    FROM messages
    WHERE user_id = ? AND status = 'completed'
    ORDER BY created_at DESC
    LIMIT ?
  `,
    )
    .all(userId, limit);
  return (rows as unknown as MessageRecord[]).sort((a, b) =>
    a.created_at.localeCompare(b.created_at),
  );
}

export function transaction<T>(fn: () => T): T {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

export function finishMessage(id: string, status: "completed" | "failed") {
  getDb()
    .prepare("UPDATE messages SET status = ? WHERE id = ?")
    .run(status, id);
}

// Only server-issued UUID namespaces can expand explicit recall across conversations.
function recallScope(id: string) {
  return /^[a-f0-9-]{36}:[a-f0-9-]{36}$/.test(id)
    ? id.split(":")[0] + ":%"
    : "";
}
