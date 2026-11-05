import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { SEED_SIGNS } from "../data/signs.js";

// src/db and dist/db both sit two levels below the server package root.
const SERVER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/** File used when DATABASE_PATH is not set. */
export function defaultDatabasePath(): string {
  return path.join(SERVER_ROOT, "data", "signconnect.sqlite");
}

/**
 * `DATABASE_PATH` from the environment, or the default file under server/data.
 * Relative paths are resolved from the server package, not the shell's cwd.
 * `:memory:` keeps the database for that process only.
 */
export function databasePath(): string {
  const configured = process.env.DATABASE_PATH?.trim();
  if (!configured) return defaultDatabasePath();
  if (configured === ":memory:") return configured;
  return path.isAbsolute(configured) ? configured : path.resolve(SERVER_ROOT, configured);
}

/**
 * Open SQLite, create tables, and refresh the sign vocabulary.
 * Saved conversations already in the file are left as they are.
 */
export function openDatabase(filename: string = databasePath()): Database.Database {
  if (filename !== ":memory:") {
    fs.mkdirSync(path.dirname(path.resolve(filename)), { recursive: true });
  }
  const db = new Database(filename);
  if (filename !== ":memory:") db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS signs (
      id TEXT PRIMARY KEY,
      gesture TEXT NOT NULL,
      word TEXT NOT NULL,
      description TEXT NOT NULL,
      source TEXT NOT NULL,
      sort_order INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS transcripts (
      id TEXT PRIMARY KEY,
      text TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  seedSigns(db);
  return db;
}

function seedSigns(db: Database.Database): void {
  const upsert = db.prepare(`
    INSERT INTO signs (id, gesture, word, description, source, sort_order)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      gesture = excluded.gesture,
      word = excluded.word,
      description = excluded.description,
      source = excluded.source,
      sort_order = excluded.sort_order
  `);
  const placeholders = SEED_SIGNS.map(() => "?").join(", ");
  const removeStale = db.prepare(`DELETE FROM signs WHERE id NOT IN (${placeholders})`);
  const write = db.transaction(() => {
    SEED_SIGNS.forEach((sign, index) => {
      upsert.run(sign.id, sign.gesture, sign.word, sign.description, sign.source, index);
    });
    removeStale.run(...SEED_SIGNS.map((sign) => sign.id));
  });
  write();
}
