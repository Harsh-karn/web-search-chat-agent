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

  initSchema(dbInstance);
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
  const existing = db.prepare("SELECT id, timezone FROM users WHERE id = ?").get(userId) as
    | { id: string; timezone: string | null }
    | undefined;

  if (!existing) {
    db.prepare(`
      INSERT OR REPLACE INTO users (id, created_at, timezone) 
      VALUES (?, ?, ?)
    `).run(userId, new Date().toISOString(), timezone || null);
  } else if (timezone && timezone !== existing.timezone) {
    db.prepare(`UPDATE users SET timezone = ? WHERE id = ?`).run(timezone, userId);
  }
}

export function getUserTimezone(userId: string): string | null {
  const db = getDb();
  const user = db.prepare("SELECT timezone FROM users WHERE id = ?").get(userId) as
    | { timezone: string | null }
    | undefined;
  return user?.timezone || null;
}

export function saveMessage(msg: {
  id: string;
  userId: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
}): void {
  const db = getDb();
  ensureUser(msg.userId);

  const createdAt = msg.createdAt || new Date().toISOString();
  db.prepare(`
    INSERT OR REPLACE INTO messages (id, user_id, role, content, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(msg.id, msg.userId, msg.role, msg.content, createdAt);
}

export function saveSources(
  sources: Array<{
    id?: string;
    messageId: string;
    url: string;
    title: string;
    publishedAt?: string | null;
  }>
): void {
  if (sources.length === 0) return;
  const db = getDb();

  const insert = db.prepare(`
    INSERT OR REPLACE INTO answer_sources (id, message_id, url, title, published_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  for (const row of sources) {
    const id = row.id || `src_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    insert.run(id, row.messageId, row.url, row.title, row.publishedAt || null);
  }
}

export function getMessagesByDateRange(
  userId: string,
  startIso: string,
  endIso: string
): MessageRecord[] {
  const db = getDb();
  const rows = db
    .prepare(
      `
    SELECT id, user_id, role, content, created_at
    FROM messages
    WHERE user_id = ? AND created_at >= ? AND created_at <= ?
    ORDER BY created_at ASC
  `
    )
    .all(userId, startIso, endIso);
  return rows as unknown as MessageRecord[];
}

export function getMessagesByKeyword(
  userId: string,
  keyword: string,
  limit: number = 10
): MessageRecord[] {
  const db = getDb();
  const rows = db
    .prepare(
      `
    SELECT id, user_id, role, content, created_at
    FROM messages
    WHERE user_id = ? AND content LIKE ?
    ORDER BY created_at DESC
    LIMIT ?
  `
    )
    .all(userId, `%${keyword}%`, limit);
  return rows as unknown as MessageRecord[];
}

export function getSourcesForMessage(messageId: string): SourceRecord[] {
  const db = getDb();
  const rows = db
    .prepare(
      `
    SELECT id, message_id, url, title, published_at
    FROM answer_sources
    WHERE message_id = ?
  `
    )
    .all(messageId);
  return rows as unknown as SourceRecord[];
}

export function getRecentMessages(userId: string, limit: number = 20): MessageRecord[] {
  const db = getDb();
  const rows = db
    .prepare(
      `
    SELECT id, user_id, role, content, created_at
    FROM messages
    WHERE user_id = ?
    ORDER BY created_at ASC
    LIMIT ?
  `
    )
    .all(userId, limit);
  return rows as unknown as MessageRecord[];
}
