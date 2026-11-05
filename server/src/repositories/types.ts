// Repository interfaces. Routes depend only on these, so the in-memory
// implementations can later be swapped for PostgreSQL ones without touching routes.

export interface Sign {
  id: string;
  /** Label emitted by the recognizer (e.g. MediaPipe's "Open_Palm", or "Please"). */
  gesture: string;
  /** Word added to the sentence when this sign is recognized. */
  word: string;
  description: string;
  /** "mediapipe" for a canned gesture, "landmarks" for a hand-shape sign. */
  source: "mediapipe" | "landmarks";
}

export interface Transcript {
  id: string;
  text: string;
  createdAt: string;
}

export interface SignRepository {
  list(): Promise<Sign[]>;
}

export interface TranscriptRepository {
  list(): Promise<Transcript[]>;
  create(text: string): Promise<Transcript>;
  delete(id: string): Promise<boolean>;
}
