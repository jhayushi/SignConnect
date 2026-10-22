import { MediaPipeRecognizer } from "./mediaPipeRecognizer";
import type { SignRecognizer } from "./types";

export type { Point, RecognitionResult, SignRecognizer } from "./types";

/** Single place to choose the recognizer implementation. */
export function createRecognizer(): SignRecognizer {
  return new MediaPipeRecognizer();
}
