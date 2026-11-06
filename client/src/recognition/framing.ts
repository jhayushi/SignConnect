import type { Point } from "./types";

export type FramingTip = "no-hand" | "too-far" | "too-close" | "off-center" | "good";

export const FRAMING_MESSAGES: Record<FramingTip, string> = {
  "no-hand": "Raise your hand into the frame",
  "too-far": "Move a little closer",
  "too-close": "Move back a little",
  "off-center": "Keep your hand inside the frame",
  good: "Looking good — hold the sign steady",
};

/**
 * Plain-language advice about how the hand sits in the frame.
 * Recognition is most reliable when the whole hand is visible and fills a
 * reasonable part of the picture.
 */
export function framingTip(hands: Point[][]): FramingTip {
  if (hands.length === 0) return "no-hand";
  // Judge by the largest hand; that is usually the one signing.
  let biggest = 0;
  let edge = false;
  for (const hand of hands) {
    if (hand.length < 21) continue;
    const xs = hand.map((p) => p.x);
    const ys = hand.map((p) => p.y);
    const size = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    if (size > biggest) {
      biggest = size;
      edge = Math.min(...xs) < 0.02 || Math.max(...xs) > 0.98 || Math.min(...ys) < 0.02 || Math.max(...ys) > 0.98;
    }
  }
  if (biggest === 0) return "no-hand";
  if (edge) return "off-center";
  if (biggest < 0.16) return "too-far";
  if (biggest > 0.75) return "too-close";
  return "good";
}
