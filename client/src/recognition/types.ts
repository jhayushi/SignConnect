export interface Point {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

export interface RecognitionResult {
  /** Recognizer-specific label (e.g. "Open_Palm" or "Please"), or null when nothing is recognized. */
  label: string | null;
  confidence: number;
  /** Normalized hand landmarks (one array of 21 points per hand), used for drawing. */
  landmarks: Point[][];
  /** Metric landmarks, one array per hand, when the model provides them. */
  worldLandmarks?: Point[][];
  /** Which physical hand each landmark array belongs to, when known. */
  handedness?: ("Left" | "Right" | "Unknown")[];
}

/**
 * Anything that can turn a video frame into a sign label.
 * The default recognizer uses MediaPipe gestures plus hand landmarks.
 */
export interface SignRecognizer {
  init(): Promise<void>;
  recognize(video: HTMLVideoElement, timestampMs: number): RecognitionResult;
  close(): void;
}
