export interface Point {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

export interface RecognitionResult {
  /** Recognizer-specific label (e.g. "Open_Palm"), or null when nothing is recognized. */
  label: string | null;
  confidence: number;
  /** Normalized hand landmarks (one array of 21 points per hand), used for drawing. */
  landmarks: Point[][];
}

/**
 * Anything that can turn a video frame into a sign label.
 * MediaPipe today; a vision-API recognizer can implement this later.
 */
export interface SignRecognizer {
  init(): Promise<void>;
  recognize(video: HTMLVideoElement, timestampMs: number): RecognitionResult;
  close(): void;
}
