// Repository interfaces. Routes depend only on these, so the SQLite
// implementations can later be swapped for another database without touching routes.

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
  get(id: string): Promise<Transcript | null>;
  create(text: string): Promise<Transcript>;
  delete(id: string): Promise<boolean>;
}

/** One labeled hand after the client has normalized it. 21 points. */
export interface LandmarkSample {
  id: string;
  label: string;
  createdAt: string;
  landmarks: { x: number; y: number; z: number }[];
}

export interface SampleRepository {
  list(label?: string): Promise<LandmarkSample[]>;
  count(label?: string): Promise<number>;
  createMany(rows: { label: string; landmarks: LandmarkSample["landmarks"] }[]): Promise<number>;
  delete(id: string): Promise<boolean>;
  clear(label?: string): Promise<number>;
}
