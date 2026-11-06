import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type { LandmarkSample, SampleRepository } from "./types.js";

interface SampleRow {
  id: string;
  label: string;
  created_at: string;
  landmarks: string;
}

function toSample(row: SampleRow): LandmarkSample {
  return {
    id: row.id,
    label: row.label,
    createdAt: row.created_at,
    landmarks: JSON.parse(row.landmarks) as LandmarkSample["landmarks"],
  };
}

export class SqliteSampleRepository implements SampleRepository {
  constructor(private readonly db: Database.Database) {}

  async list(label?: string): Promise<LandmarkSample[]> {
    const rows = label
      ? (this.db
          .prepare("SELECT id, label, created_at, landmarks FROM landmark_samples WHERE label = ? ORDER BY created_at DESC")
          .all(label) as SampleRow[])
      : (this.db
          .prepare("SELECT id, label, created_at, landmarks FROM landmark_samples ORDER BY created_at DESC")
          .all() as SampleRow[]);
    return rows.map(toSample);
  }

  async count(label?: string): Promise<number> {
    const row = label
      ? (this.db.prepare("SELECT COUNT(*) AS count FROM landmark_samples WHERE label = ?").get(label) as { count: number })
      : (this.db.prepare("SELECT COUNT(*) AS count FROM landmark_samples").get() as { count: number });
    return row.count;
  }

  async createMany(rows: { label: string; landmarks: LandmarkSample["landmarks"] }[]): Promise<number> {
    const insert = this.db.prepare(
      "INSERT INTO landmark_samples (id, label, created_at, landmarks) VALUES (?, ?, ?, ?)",
    );
    const write = this.db.transaction((batch: { label: string; landmarks: LandmarkSample["landmarks"] }[]) => {
      const createdAt = new Date().toISOString();
      for (const row of batch) {
        insert.run(randomUUID(), row.label, createdAt, JSON.stringify(row.landmarks));
      }
      return batch.length;
    });
    return write(rows);
  }

  async delete(id: string): Promise<boolean> {
    const result = this.db.prepare("DELETE FROM landmark_samples WHERE id = ?").run(id);
    return result.changes > 0;
  }

  async clear(label?: string): Promise<number> {
    const result = label
      ? this.db.prepare("DELETE FROM landmark_samples WHERE label = ?").run(label)
      : this.db.prepare("DELETE FROM landmark_samples").run();
    return result.changes;
  }
}
