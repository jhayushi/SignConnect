import { MediaPipeRecognizer } from "./mediaPipeRecognizer";
import { GestureTracker, type HandFrame } from "./landmarkSigns";
import type { RecognitionResult, SignRecognizer } from "./types";

/**
 * MediaPipe's canned gestures, plus landmark signs for a few more words.
 * Built-in labels still come through when no landmark sign matches.
 */
export class CompositeRecognizer implements SignRecognizer {
  private readonly gestures = new MediaPipeRecognizer();
  private readonly tracker = new GestureTracker();

  init(): Promise<void> {
    return this.gestures.init();
  }

  recognize(video: HTMLVideoElement, timestampMs: number): RecognitionResult {
    const raw = this.gestures.recognize(video, timestampMs);
    const hands: HandFrame[] = raw.landmarks.map((landmarks, index) => ({
      landmarks,
      worldLandmarks: raw.worldLandmarks?.[index],
      handedness: raw.handedness?.[index] ?? "Unknown",
    }));
    const decision = this.tracker.decide(hands, { label: raw.label, confidence: raw.confidence }, timestampMs);
    return { ...raw, label: decision.label, confidence: decision.confidence };
  }

  close(): void {
    this.gestures.close();
    this.tracker.reset();
  }
}
