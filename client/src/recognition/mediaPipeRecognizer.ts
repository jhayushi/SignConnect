import { FilesetResolver, GestureRecognizer } from "@mediapipe/tasks-vision";
import type { RecognitionResult, SignRecognizer } from "./types";

// Keep the WASM version in sync with the installed @mediapipe/tasks-vision package.
const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task";

export class MediaPipeRecognizer implements SignRecognizer {
  private recognizer: GestureRecognizer | null = null;

  async init(): Promise<void> {
    if (this.recognizer) return;
    const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
    const create = (delegate: "GPU" | "CPU") =>
      GestureRecognizer.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate },
        runningMode: "VIDEO",
        numHands: 1,
      });
    try {
      this.recognizer = await create("GPU");
    } catch {
      // Some machines/browsers don't support the GPU delegate.
      this.recognizer = await create("CPU");
    }
  }

  recognize(video: HTMLVideoElement, timestampMs: number): RecognitionResult {
    if (!this.recognizer) throw new Error("MediaPipeRecognizer.init() must be called first");
    const result = this.recognizer.recognizeForVideo(video, timestampMs);
    const top = result.gestures[0]?.[0];
    const label = top && top.categoryName !== "None" ? top.categoryName : null;
    return { label, confidence: top?.score ?? 0, landmarks: result.landmarks };
  }

  close(): void {
    this.recognizer?.close();
    this.recognizer = null;
  }
}
