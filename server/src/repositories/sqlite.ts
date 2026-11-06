import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type { Sign, SignRepository, Transcript, TranscriptRepository } from "./types.js";

interface SignRow {
  id: string;
  gesture: string;
  word: string;
  description: string;
  source: string;
}

interface TranscriptRow {
  id: string;
  text: string;
  created_at: string;
}

function toSign(row: SignRow): Sign {
  if (row.source !== "mediapipe" && row.source !== "landmarks") {
    throw new Error(`Unknown sign source "${row.source}" for ${row.id}`);
  }
  return {
    id: row.id,
    gesture: row.gesture,
    word: row.word,
    description: row.description,
    source: row.source,
  };
}

function toTranscript(row: TranscriptRow): Transcript {
  return { id: row.id, text: row.text, createdAt: row.created_at };
}

export class SqliteSignRepository implements SignRepository {
  constructor(private readonly db: Database.Database) {}

  async list(): Promise<Sign[]> {
    const rows = this.db
      .prepare("SELECT id, gesture, word, description, source FROM signs ORDER BY sort_order ASC")
      .all() as SignRow[];
    return rows.map(toSign);
  }
}

export class SqliteTranscriptRepository implements TranscriptRepository {
  constructor(private readonly db: Database.Database) {}

  async list(): Promise<Transcript[]> {
    const rows = this.db
      .prepare("SELECT id, text, created_at FROM transcripts ORDER BY created_at DESC, rowid DESC")
      .all() as TranscriptRow[];
    return rows.map(toTranscript);
  }

  async get(id: string): Promise<Transcript | null> {
    const row = this.db.prepare("SELECT id, text, created_at FROM transcripts WHERE id = ?").get(id) as TranscriptRow | undefined;
    return row ? toTranscript(row) : null;
  }

  async create(text: string): Promise<Transcript> {
    const transcript: Transcript = {
      id: randomUUID(),
      text,
      createdAt: new Date().toISOString(),
    };
    this.db.prepare("INSERT INTO transcripts (id, text, created_at) VALUES (?, ?, ?)").run(
      transcript.id,
      transcript.text,
      transcript.createdAt,
    );
    return transcript;
  }

  async delete(id: string): Promise<boolean> {
    const result = this.db.prepare("DELETE FROM transcripts WHERE id = ?").run(id);
    return result.changes > 0;
  }
}
