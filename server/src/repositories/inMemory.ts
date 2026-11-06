// Kept so the interfaces can be exercised without a database file.
// The running server uses the SQLite repositories instead.
import { randomUUID } from "node:crypto";
import type { Sign, SignRepository, Transcript, TranscriptRepository } from "./types.js";

export class InMemorySignRepository implements SignRepository {
  constructor(private readonly signs: Sign[]) {}

  async list(): Promise<Sign[]> {
    return [...this.signs];
  }
}

export class InMemoryTranscriptRepository implements TranscriptRepository {
  private transcripts: Transcript[] = [];

  async list(): Promise<Transcript[]> {
    // Newest first
    return [...this.transcripts].reverse();
  }

  async get(id: string): Promise<Transcript | null> {
    return this.transcripts.find((transcript) => transcript.id === id) ?? null;
  }

  async create(text: string): Promise<Transcript> {
    const transcript: Transcript = { id: randomUUID(), text, createdAt: new Date().toISOString() };
    this.transcripts.push(transcript);
    return transcript;
  }

  async delete(id: string): Promise<boolean> {
    const before = this.transcripts.length;
    this.transcripts = this.transcripts.filter((t) => t.id !== id);
    return this.transcripts.length < before;
  }
}
