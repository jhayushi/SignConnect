import { MediaPipeRecognizer } from "./mediaPipeRecognizer";
import { GestureTracker, type HandFrame } from "./landmarkSigns";
import { OneEuroLandmarkFilter } from "./signal";
import type { Point, RecognitionResult, SignRecognizer } from "./types";

/**
 * MediaPipe's canned gestures, plus landmark signs for a few more words.
 * Built-in labels still come through when no landmark sign matches.
 */
export class CompositeRecognizer implements SignRecognizer {
  private readonly gestures = new MediaPipeRecognizer();
  private readonly tracker = new GestureTracker();
  private readonly smoothers: OneEuroLandmarkFilter[] = [];
  private lastTimestamp = 0;

  init(): Promise<void> {
    return this.gestures.init();
  }

  recognize(video: HTMLVideoElement, timestampMs: number): RecognitionResult {
    const raw = this.gestures.recognize(video, timestampMs);
    const dt = this.lastTimestamp ? (timestampMs - this.lastTimestamp) / 1000 : 0;
    this.lastTimestamp = timestampMs;
    const hands: HandFrame[] = raw.landmarks.map((landmarks, index) => ({
      landmarks: this.smooth(index, landmarks, dt),
      worldLandmarks: raw.worldLandmarks?.[index],
      handedness: raw.handedness?.[index] ?? "Unknown",
    }));
    this.smoothers.length = hands.length;
    const decision = this.tracker.decide(hands, { label: raw.label, confidence: raw.confidence }, timestampMs);
    return { ...raw, label: decision.label, confidence: decision.confidence };
  }

  close(): void {
    this.gestures.close();
    this.tracker.reset();
    this.smoothers.forEach((filter) => filter.reset());
    this.lastTimestamp = 0;
  }

  private smooth(index: number, landmarks: Point[], dtSeconds: number): Point[] {
    const filter = (this.smoothers[index] ??= new OneEuroLandmarkFilter());
    return filter.apply(landmarks, dtSeconds);
  }
}
