import { FilesetResolver, GestureRecognizer, type Category, type Landmark } from "@mediapipe/tasks-vision";
import type { Point, RecognitionResult, SignRecognizer } from "./types";

// A relaxed second hand is often read as an open palm or a fist. Don't let that
// hide a more specific gesture on the other hand.
const SPECIFIC_GESTURES = new Set(["Thumb_Up", "Thumb_Down", "Pointing_Up", "Victory", "ILoveYou"]);

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
        numHands: 2,
        // Slightly stricter than the 0.5 defaults: fewer phantom hands and jittery landmarks.
        minHandDetectionConfidence: 0.6,
        minHandPresenceConfidence: 0.6,
        minTrackingConfidence: 0.6,
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
    const landmarks = result.landmarks.map(toPoints);
    const canned = chooseCannedGesture(result.gestures, landmarks);
    return {
      label: canned.label,
      confidence: canned.confidence,
      landmarks,
      worldLandmarks: result.worldLandmarks.map(toPoints),
      handedness: result.handedness.map(topHand),
    };
  }

  close(): void {
    this.recognizer?.close();
    this.recognizer = null;
  }
}

function toPoints(landmarks: Landmark[]): Point[] {
  return landmarks.map((point) => ({
    x: point.x,
    y: point.y,
    z: point.z,
    visibility: point.visibility ?? 0,
  }));
}

function topHand(categories: Category[]): "Left" | "Right" | "Unknown" {
  const name = categories[0]?.categoryName;
  return name === "Left" || name === "Right" ? name : "Unknown";
}

function palmSpan(landmarks: Point[] | undefined): number {
  if (!landmarks || landmarks.length < 18) return 0;
  return Math.hypot(landmarks[5].x - landmarks[17].x, landmarks[5].y - landmarks[17].y);
}

/**
 * With two hands in frame, a relaxed fist or open palm should not hide the
 * hand the person is actually signing. A specific gesture (thumbs up, and so
 * on) wins when it is confident; otherwise use the larger hand.
 */
export function chooseCannedGesture(
  gestures: Category[][],
  landmarks: Point[][],
): { label: string | null; confidence: number } {
  const hands = gestures.flatMap((hand, index) => {
    const gesture = hand[0];
    if (!gesture || gesture.categoryName === "None") return [];
    return [{ gesture, span: palmSpan(landmarks[index]) }];
  });
  const specific = hands.filter(
    (hand) => SPECIFIC_GESTURES.has(hand.gesture.categoryName) && hand.gesture.score >= 0.7,
  );
  const pool = specific.length > 0 ? specific : hands;
  let best: (typeof hands)[number] | null = null;
  for (const hand of pool) {
    if (!best || hand.span > best.span || (hand.span === best.span && hand.gesture.score > best.gesture.score)) {
      best = hand;
    }
  }
  return { label: best?.gesture.categoryName ?? null, confidence: best?.gesture.score ?? 0 };
}
