import type { Point } from "./types";
import { EmaLandmarkFilter, OneEuroLandmarkFilter, ema, normalizeLandmarks } from "./signal";

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function point(x: number, y: number, z = 0): Point {
  return { x, y, z, visibility: 1 };
}

function close(a: number, b: number, eps = 1e-6): boolean {
  return Math.abs(a - b) <= eps;
}

const hand = Array.from({ length: 21 }, (_, index) => point(0.2 + index * 0.01, 0.4, index * 0.001));
hand[5] = point(0.3, 0.35, 0);
hand[17] = point(0.42, 0.36, 0);
hand[9] = point(0.36, 0.3, 0);

const normalized = normalizeLandmarks(hand);
check(close(normalized[0].x, 0) && close(normalized[0].y, 0) && close(normalized[0].z, 0), "wrist should sit at the origin");
const palm = Math.hypot(normalized[5].x - normalized[17].x, normalized[5].y - normalized[17].y, normalized[5].z - normalized[17].z);
check(close(palm, 1, 1e-9) || close(Math.hypot(normalized[9].x, normalized[9].y, normalized[9].z), 1, 1e-9), "palm scale should be 1");

const shifted = hand.map((p) => point(p.x * 2.5 + 4, p.y * 2.5 - 3, p.z * 2.5 + 1));
const normalizedShifted = normalizeLandmarks(shifted);
check(
  normalized.every((p, i) => close(p.x, normalizedShifted[i].x, 1e-9) && close(p.y, normalizedShifted[i].y, 1e-9) && close(p.z, normalizedShifted[i].z, 1e-9)),
  "normalization should ignore translation and scale",
);

check(ema(null, 2, 0.4) === 2, "ema starts at the first sample");
check(close(ema(2, 4, 0.5), 3), "ema blends halfway at alpha 0.5");

const filter = new EmaLandmarkFilter(0.5);
const first = filter.apply(hand);
const second = filter.apply(hand.map((p) => point(p.x + 2, p.y, p.z)));
check(close(first[0].x, hand[0].x), "first ema frame is the raw frame");
check(second[0].x > hand[0].x && second[0].x < hand[0].x + 2, "ema should move partway toward the new sample");

const noisy = new OneEuroLandmarkFilter({ minCutoff: 1, beta: 0.01, dCutoff: 1 });
let value = 0;
const raw: number[] = [];
const smooth: number[] = [];
for (let i = 0; i < 30; i++) {
  value = i < 5 ? 0 : 1;
  const jitter = i % 2 === 0 ? 0.2 : -0.2;
  const sample = hand.map((p, index) => point(index === 8 ? value + (i > 5 ? jitter : 0) : p.x, p.y, p.z));
  raw.push(sample[8].x);
  smooth.push(noisy.apply(sample, 1 / 30)[8].x);
}
const rawSpan = Math.max(...raw.slice(10)) - Math.min(...raw.slice(10));
const smoothSpan = Math.max(...smooth.slice(10)) - Math.min(...smooth.slice(10));
check(smoothSpan < rawSpan, `one-euro should shrink jitter (${smoothSpan} vs ${rawSpan})`);
check(smooth[smooth.length - 1] > 0.5, "one-euro should still reach the new level");

console.log("signal processing ok");
