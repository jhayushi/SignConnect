import type { Point } from "./types";

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function clone(point: Point): Point {
  return { x: point.x, y: point.y, z: point.z, visibility: point.visibility };
}

/**
 * Move the wrist to the origin and divide by palm size so a pose does not
 * depend on where the hand sits in the frame or how large it appears.
 */
export function normalizeLandmarks(points: Point[]): Point[] {
  if (points.length < 21) throw new Error("expected 21 landmarks");
  const wrist = points[0];
  const shifted = points.map((point) => ({
    x: point.x - wrist.x,
    y: point.y - wrist.y,
    z: point.z - wrist.z,
    visibility: point.visibility,
  }));
  const palm = Math.max(dist(shifted[5], shifted[17]), dist(shifted[0], shifted[9]), 1e-6);
  return shifted.map((point) => ({
    x: point.x / palm,
    y: point.y / palm,
    z: point.z / palm,
    visibility: point.visibility,
  }));
}

/** Exponential moving average. `alpha` is the weight of the new sample (0–1). */
export function ema(previous: number | null, value: number, alpha: number): number {
  if (previous === null || alpha >= 1) return value;
  if (alpha <= 0) return previous;
  return alpha * value + (1 - alpha) * previous;
}

export class EmaLandmarkFilter {
  private previous: Point[] | null = null;

  constructor(private readonly alpha: number) {}

  reset(): void {
    this.previous = null;
  }

  apply(frame: Point[]): Point[] {
    if (!this.previous || this.previous.length !== frame.length) {
      this.previous = frame.map(clone);
      return this.previous.map(clone);
    }
    const next = frame.map((point, index) => {
      const prior = this.previous![index];
      return {
        x: ema(prior.x, point.x, this.alpha),
        y: ema(prior.y, point.y, this.alpha),
        z: ema(prior.z, point.z, this.alpha),
        visibility: point.visibility,
      };
    });
    this.previous = next;
    return next.map(clone);
  }
}

export interface OneEuroConfig {
  /** Lowest cutoff frequency in Hz. Higher follows the raw signal more closely. */
  minCutoff: number;
  /** How much extra cutoff to add when the signal is moving. */
  beta: number;
  /** Cutoff for the derivative estimate, in Hz. */
  dCutoff: number;
}

export const DEFAULT_ONE_EURO: OneEuroConfig = {
  minCutoff: 1.2,
  beta: 0.8,
  dCutoff: 1,
};

function smoothingAlpha(cutoffHz: number, dtSeconds: number): number {
  if (dtSeconds <= 0) return 1;
  const tau = 1 / (2 * Math.PI * Math.max(cutoffHz, 1e-3));
  return 1 / (1 + tau / dtSeconds);
}

/** One Euro filter for a single scalar, as used for noisy tracking signals. */
export class OneEuroScalar {
  private previous: number | null = null;
  private derivative = 0;

  constructor(private readonly config: OneEuroConfig = DEFAULT_ONE_EURO) {}

  reset(): void {
    this.previous = null;
    this.derivative = 0;
  }

  apply(value: number, dtSeconds: number): number {
    if (this.previous === null || dtSeconds <= 0) {
      this.previous = value;
      this.derivative = 0;
      return value;
    }
    const rawDerivative = (value - this.previous) / dtSeconds;
    const derivativeAlpha = smoothingAlpha(this.config.dCutoff, dtSeconds);
    this.derivative = derivativeAlpha * rawDerivative + (1 - derivativeAlpha) * this.derivative;
    const cutoff = this.config.minCutoff + this.config.beta * Math.abs(this.derivative);
    const alpha = smoothingAlpha(cutoff, dtSeconds);
    const filtered = alpha * value + (1 - alpha) * this.previous;
    this.previous = filtered;
    return filtered;
  }
}

/** Smooth a 21-point hand. A large wrist jump resets the filter so hands are not blended. */
export class OneEuroLandmarkFilter {
  private axes: OneEuroScalar[] = [];
  private previousWrist: Point | null = null;

  constructor(private readonly config: OneEuroConfig = DEFAULT_ONE_EURO) {}

  reset(): void {
    this.axes = [];
    this.previousWrist = null;
  }

  apply(frame: Point[], dtSeconds: number): Point[] {
    if (this.previousWrist && dist(frame[0], this.previousWrist) > 0.25) this.reset();
    const filtered = frame.map((point, index) => {
      const base = index * 3;
      const x = this.axis(base).apply(point.x, dtSeconds);
      const y = this.axis(base + 1).apply(point.y, dtSeconds);
      const z = this.axis(base + 2).apply(point.z, dtSeconds);
      return { x, y, z, visibility: point.visibility };
    });
    this.previousWrist = clone(filtered[0]);
    return filtered;
  }

  private axis(index: number): OneEuroScalar {
    return (this.axes[index] ??= new OneEuroScalar(this.config));
  }
}
