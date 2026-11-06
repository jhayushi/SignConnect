// Conversational signs on top of MediaPipe's built-in gestures.
// Finger pose comes from landmark distances, so the hand does not have to
// point up. Two-hand signs use positions in the camera frame. PLEASE,
// THANK YOU, and SORRY are motions; once one is seen, the label stays up
// long enough for the sentence builder's hold-to-add rule to commit it.

import { Handshape, classifyOneHand } from "./handshapes";
import type { Point } from "./types";

export const LandmarkGesture = {
  Please: "Please",
  ThankYou: "ThankYou",
  Sorry: "Sorry",
  Help: "Help",
  Good: "Good",
  More: "More",
  Done: "Done",
  What: "What",
  Name: "Name",
  Friend: "Friend",
  Love: "Love",
} as const;

export type LandmarkLabel = (typeof LandmarkGesture)[keyof typeof LandmarkGesture];

export interface HandFrame {
  landmarks: Point[];
  worldLandmarks?: Point[];
  handedness?: "Left" | "Right" | "Unknown";
}

export interface ClassifiedSign {
  label: string;
  confidence: number;
}

type FingerName = "index" | "middle" | "ring" | "pinky";
type FingerState = "extended" | "curled" | "partial";
type Facing = "up" | "down" | "camera" | "other";
type HandShape = "open" | "fist" | "other";

interface Fingers {
  index: FingerState;
  middle: FingerState;
  ring: FingerState;
  pinky: FingerState;
}

export interface AnalyzedHand {
  image: Point[];
  pose: Point[];
  handedness: "Left" | "Right" | "Unknown";
  palmWidth: number;
  palmCenter: Point;
  wrist: Point;
  fingers: Fingers;
  open: boolean;
  fist: boolean;
  flatO: boolean;
  hShape: boolean;
  indexOnly: boolean;
  together: boolean;
  facing: Facing;
  shape: HandShape;
}

const FINGER_JOINTS: { name: FingerName; mcp: number; pip: number; tip: number }[] = [
  { name: "index", mcp: 5, pip: 6, tip: 8 },
  { name: "middle", mcp: 9, pip: 10, tip: 12 },
  { name: "ring", mcp: 13, pip: 14, tip: 16 },
  { name: "pinky", mcp: 17, pip: 18, tip: 20 },
];

const LATCH_MS = 1400;
const COOLDOWN_MS = 700;
const CIRCLE_WINDOW_MS = 900;
const APPROACH_WINDOW_MS = 800;
const SWITCH_FRAMES = 3;
const CLEAR_FRAMES = 4;

const MOTION_BLOCKS: Record<string, string[]> = {
  [LandmarkGesture.Please]: ["Open_Palm"],
  [LandmarkGesture.ThankYou]: ["Open_Palm"],
  [LandmarkGesture.Sorry]: ["Closed_Fist"],
  [Handshape.Where]: ["Pointing_Up"],
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function dist3(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function dist2(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function sub(a: Point, b: Point): Point {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z, visibility: 0 };
}

function dot(a: Point, b: Point): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function mag(a: Point): number {
  return Math.hypot(a.x, a.y, a.z);
}

function scale(a: Point, k: number): Point {
  return { x: a.x * k, y: a.y * k, z: a.z * k, visibility: 0 };
}

function cross(a: Point, b: Point): Point {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
    visibility: 0,
  };
}

function centroid(points: Point[]): Point {
  const n = points.length || 1;
  let x = 0;
  let y = 0;
  let z = 0;
  for (const p of points) {
    x += p.x;
    y += p.y;
    z += p.z;
  }
  return { x: x / n, y: y / n, z: z / n, visibility: 1 };
}

function finitePoint(p: Point | undefined): p is Point {
  return !!p && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z);
}

function usable(landmarks: Point[] | undefined): landmarks is Point[] {
  if (!landmarks || landmarks.length < 21 || !landmarks.every(finitePoint)) return false;
  let span = 0;
  for (let i = 1; i < landmarks.length; i++) span = Math.max(span, dist3(landmarks[0], landmarks[i]));
  return span > 1e-4;
}

function jointAngle(a: Point, b: Point, c: Point): number {
  const u = sub(a, b);
  const v = sub(c, b);
  const denom = mag(u) * mag(v);
  if (denom < 1e-8) return 0;
  return Math.acos(clamp(dot(u, v) / denom, -1, 1));
}

function fingerState(pose: Point[], mcp: number, pip: number, tip: number): FingerState {
  const ratio = dist3(pose[tip], pose[mcp]) / Math.max(dist3(pose[pip], pose[mcp]), 1e-6);
  const angle = jointAngle(pose[mcp], pose[pip], pose[tip]);
  if ((ratio >= 1.6 && angle >= 2.15) || ratio >= 1.9) return "extended";
  if ((ratio <= 1.32 && angle <= 1.75) || ratio <= 1.05) return "curled";
  return "partial";
}

/** Unit normal pointing out of the palm. Image y grows downward; smaller z is closer to the camera. */
export function palmOutNormal(image: Point[], handedness: "Left" | "Right" | "Unknown"): Point | null {
  if (!usable(image) || handedness === "Unknown") return null;
  const raw = cross(sub(image[5], image[0]), sub(image[17], image[0]));
  // cross(wrist→index, wrist→pinky) points out of a left palm and out of the
  // back of a right palm, in a camera frame where +z is farther away.
  const outward = handedness === "Right" ? scale(raw, -1) : raw;
  const m = mag(outward);
  if (m < 1e-8) return null;
  return scale(outward, 1 / m);
}

function facingOf(image: Point[], handedness: "Left" | "Right" | "Unknown"): Facing {
  const n = palmOutNormal(image, handedness);
  if (!n) return "other";
  const ax = Math.abs(n.x);
  const ay = Math.abs(n.y);
  const az = Math.abs(n.z);
  if (ay > 0.62 && ay > ax + 0.08 && ay > az + 0.05) return n.y < 0 ? "up" : "down";
  if (az > 0.55 && az >= ay) return "camera";
  return "other";
}

function fingersTogether(pose: Point[]): boolean {
  const tipGap = dist3(pose[8], pose[12]);
  const mcpGap = Math.max(dist3(pose[5], pose[9]), 1e-6);
  return tipGap <= mcpGap * 1.45;
}

function isFlatO(pose: Point[], fingers: Fingers): boolean {
  const palm = dist3(pose[5], pose[17]);
  if (palm < 1e-6) return false;
  const thumb = pose[4];
  const tips = [pose[8], pose[12], pose[16]];
  if (tips.some((tip) => dist3(thumb, tip) > palm * 0.5)) return false;
  if ([fingers.index, fingers.middle, fingers.ring].some((state) => state === "extended")) return false;
  const pinkyClose = dist3(thumb, pose[20]) <= palm * 0.72;
  if (!pinkyClose && fingers.pinky === "extended") return false;
  const cluster = centroid([thumb, ...tips]);
  const palmLength = Math.max(dist3(pose[0], pose[9]), 1e-6);
  return dist3(pose[0], cluster) >= palmLength * 0.9;
}

export function analyzeHand(frame: HandFrame): AnalyzedHand | null {
  if (!usable(frame.landmarks)) return null;
  const image = frame.landmarks;
  const pose = usable(frame.worldLandmarks) ? frame.worldLandmarks : image;
  const handedness = frame.handedness ?? "Unknown";
  const fingers = {} as Fingers;
  for (const joint of FINGER_JOINTS) {
    fingers[joint.name] = fingerState(pose, joint.mcp, joint.pip, joint.tip);
  }
  const extended = FINGER_JOINTS.filter((joint) => fingers[joint.name] === "extended").length;
  const curled = FINGER_JOINTS.filter((joint) => fingers[joint.name] === "curled").length;
  const open = extended === 4;
  const flatO = isFlatO(pose, fingers);
  const fist = curled === 4 && !flatO;
  const together = fingersTogether(pose);
  const hShape =
    fingers.index === "extended" &&
    fingers.middle === "extended" &&
    fingers.ring === "curled" &&
    fingers.pinky === "curled" &&
    together;
  const indexOnly =
    fingers.index === "extended" &&
    fingers.middle === "curled" &&
    fingers.ring === "curled" &&
    fingers.pinky === "curled";
  const shape: HandShape = open ? "open" : fist ? "fist" : "other";
  return {
    image,
    pose,
    handedness,
    palmWidth: dist2(image[5], image[17]),
    palmCenter: centroid([image[0], image[5], image[9], image[17]]),
    wrist: image[0],
    fingers,
    open,
    fist,
    flatO,
    hShape,
    indexOnly,
    together,
    facing: facingOf(image, handedness),
    shape,
  };
}

export function describeHand(hand: AnalyzedHand): string {
  const f = hand.fingers;
  return [
    `shape=${hand.shape}`,
    `facing=${hand.facing}`,
    `flatO=${hand.flatO}`,
    `h=${hand.hShape}`,
    `index=${hand.indexOnly}`,
    `together=${hand.together}`,
    `fingers=${f.index}/${f.middle}/${f.ring}/${f.pinky}`,
    `palm=${hand.palmWidth.toFixed(3)}`,
  ].join(" ");
}

function refWidth(a: AnalyzedHand, b: AnalyzedHand): number | null {
  if (a.palmWidth < 0.025 || b.palmWidth < 0.025) return null;
  return (a.palmWidth + b.palmWidth) / 2;
}

function fingerTipCluster(hand: AnalyzedHand): Point {
  return centroid([hand.image[8], hand.image[12], hand.image[16]]);
}

function matchHelp(hands: AnalyzedHand[]): ClassifiedSign | null {
  for (let i = 0; i < hands.length; i++) {
    for (let j = i + 1; j < hands.length; j++) {
      const pair = [hands[i], hands[j]];
      const fist = pair.find((hand) => hand.fist);
      const open = pair.find((hand) => hand.open);
      if (!fist || !open) continue;
      const ref = refWidth(fist, open);
      if (!ref) continue;
      const stacked = dist2(fist.palmCenter, open.palmCenter) < ref * 1.25;
      const onPalm = dist2(fist.wrist, open.palmCenter) < ref * 0.8;
      if (stacked && onPalm) return { label: LandmarkGesture.Help, confidence: 0.9 };
    }
  }
  return null;
}

function matchGood(hands: AnalyzedHand[]): ClassifiedSign | null {
  for (const a of hands) {
    if (!a.open || !a.together) continue;
    const tips = fingerTipCluster(a);
    for (const b of hands) {
      if (a === b || !b.open) continue;
      const ref = refWidth(a, b);
      if (!ref) continue;
      const intoPalm = dist2(tips, b.palmCenter);
      const intoFingers = dist2(tips, fingerTipCluster(b));
      if (intoPalm < ref * 0.62 && intoPalm < intoFingers) {
        return { label: LandmarkGesture.Good, confidence: 0.9 };
      }
    }
  }
  return null;
}

function matchFriend(hands: AnalyzedHand[]): ClassifiedSign | null {
  const hooks = hands.filter((hand) => hand.indexOnly);
  for (let i = 0; i < hooks.length; i++) {
    for (let j = i + 1; j < hooks.length; j++) {
      const a = hooks[i];
      const b = hooks[j];
      const ref = refWidth(a, b);
      if (!ref) continue;
      const tips = dist2(a.image[8], b.image[8]) < ref * 0.85;
      const crossed =
        dist2(a.image[8], b.image[6]) < ref * 0.7 && dist2(b.image[8], a.image[6]) < ref * 0.7;
      if (tips || crossed) return { label: LandmarkGesture.Friend, confidence: 0.9 };
    }
  }
  return null;
}

function matchName(hands: AnalyzedHand[]): ClassifiedSign | null {
  const named = hands.filter((hand) => hand.hShape);
  for (let i = 0; i < named.length; i++) {
    for (let j = i + 1; j < named.length; j++) {
      const a = named[i];
      const b = named[j];
      const ref = refWidth(a, b);
      if (!ref) continue;
      if (dist2(a.image[8], b.image[8]) < ref * 0.9) {
        return { label: LandmarkGesture.Name, confidence: 0.9 };
      }
    }
  }
  return null;
}

function matchFamily(hands: AnalyzedHand[]): ClassifiedSign | null {
  const shaped = hands.filter((hand) => classifyOneHand(hand)?.label === Handshape.LetterF);
  for (let i = 0; i < shaped.length; i++) {
    for (let j = i + 1; j < shaped.length; j++) {
      const ref = refWidth(shaped[i], shaped[j]);
      if (!ref) continue;
      if (dist2(shaped[i].wrist, shaped[j].wrist) < ref * 4) {
        return { label: Handshape.Family, confidence: 0.9 };
      }
    }
  }
  return null;
}

function matchLove(hands: AnalyzedHand[]): ClassifiedSign | null {
  const fists = hands.filter((hand) => hand.fist);
  for (let i = 0; i < fists.length; i++) {
    for (let j = i + 1; j < fists.length; j++) {
      const ref = refWidth(fists[i], fists[j]);
      if (!ref) continue;
      if (dist2(fists[i].wrist, fists[j].wrist) < ref * 1.05) {
        return { label: LandmarkGesture.Love, confidence: 0.9 };
      }
    }
  }
  return null;
}

function matchPalms(hands: AnalyzedHand[], facing: "up" | "down", label: string): ClassifiedSign | null {
  const open = hands.filter((hand) => hand.open && hand.facing === facing);
  for (let i = 0; i < open.length; i++) {
    for (let j = i + 1; j < open.length; j++) {
      const ref = refWidth(open[i], open[j]);
      if (!ref) continue;
      if (dist2(open[i].wrist, open[j].wrist) > ref * 1.45) {
        return { label, confidence: 0.9 };
      }
    }
  }
  return null;
}

function matchMore(hands: AnalyzedHand[]): ClassifiedSign | null {
  const pinched = hands.filter((hand) => hand.flatO);
  if (pinched.length === 0) return null;
  if (pinched.length >= 2) {
    const ref = refWidth(pinched[0], pinched[1]);
    if (ref && dist2(pinched[0].palmCenter, pinched[1].palmCenter) < ref * 2.4) {
      return { label: LandmarkGesture.More, confidence: 0.93 };
    }
  }
  return { label: LandmarkGesture.More, confidence: 0.86 };
}

export function classifyStaticSign(hands: AnalyzedHand[]): ClassifiedSign | null {
  const paired =
    matchHelp(hands) ??
    matchGood(hands) ??
    matchFriend(hands) ??
    matchName(hands) ??
    matchFamily(hands) ??
    matchLove(hands) ??
    matchPalms(hands, "up", LandmarkGesture.What) ??
    matchPalms(hands, "down", LandmarkGesture.Done);
  if (paired) return paired;
  if (hands.length === 1) {
    const one = classifyOneHand(hands[0]);
    if (one) return one;
    if (hands[0].open && hands[0].facing === "down") return { label: Handshape.Bad, confidence: 0.86 };
  }
  return matchMore(hands);
}

interface Sample {
  t: number;
  x: number;
  y: number;
  indexX: number;
  indexY: number;
  pinkyX: number;
  pinkyY: number;
  palmWidth: number;
  shape: HandShape;
  tag: string | null;
  indexOnly: boolean;
}

interface Track {
  id: number;
  samples: Sample[];
  lastX: number;
  lastY: number;
  lastT: number;
}

interface Latch {
  label: string;
  trackId: number;
  until: number;
  holds: (sample: Sample) => boolean;
}

const MOTION_RANK = [
  "Please",
  "Sorry",
  Handshape.LetterZ,
  Handshape.LetterJ,
  Handshape.Where,
  Handshape.Water,
  Handshape.Eat,
  Handshape.Drink,
  "ThankYou",
];

function windowSamples(track: Track, now: number, ms: number): Sample[] {
  return track.samples.filter((sample) => now - sample.t <= ms);
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** Wrist path loops, instead of drifting across the frame. */
function isCircle(samples: Sample[]): boolean {
  if (samples.length < 10) return false;
  const duration = samples[samples.length - 1].t - samples[0].t;
  if (duration < 420) return false;
  const cx = mean(samples.map((sample) => sample.x));
  const cy = mean(samples.map((sample) => sample.y));
  const radii = samples.map((sample) => Math.hypot(sample.x - cx, sample.y - cy));
  const meanR = mean(radii);
  if (meanR < 0.03) return false;
  const deviation = Math.sqrt(mean(radii.map((radius) => (radius - meanR) ** 2)));
  if (deviation / meanR > 0.48) return false;

  let travel = 0;
  let prev = Math.atan2(samples[0].y - cy, samples[0].x - cx);
  for (let i = 1; i < samples.length; i++) {
    const angle = Math.atan2(samples[i].y - cy, samples[i].x - cx);
    let delta = angle - prev;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    travel += delta;
    prev = angle;
  }
  return Math.abs(travel) >= Math.PI * 1.15;
}

function mostly(samples: Sample[], shape: HandShape): boolean {
  if (samples.length === 0 || samples[samples.length - 1].shape !== shape) return false;
  const hits = samples.filter((sample) => sample.shape === shape).length;
  return hits / samples.length >= 0.65;
}

function isApproach(samples: Sample[]): boolean {
  if (samples.length < 8) return false;
  const duration = samples[samples.length - 1].t - samples[0].t;
  if (duration < 380) return false;
  if (!mostly(samples, "open")) return false;
  const start = mean(samples.slice(0, 3).map((sample) => sample.palmWidth));
  const end = mean(samples.slice(-3).map((sample) => sample.palmWidth));
  if (start < 0.04 || end / start < 1.32) return false;
  let grows = 0;
  for (let i = 1; i < samples.length; i++) {
    if (samples[i].palmWidth >= samples[i - 1].palmWidth - start * 0.025) grows += 1;
  }
  return grows / (samples.length - 1) >= 0.62 && !isCircle(samples);
}

function mostlySamples(samples: Sample[], pred: (sample: Sample) => boolean): boolean {
  if (samples.length === 0 || !pred(samples[samples.length - 1])) return false;
  const hits = samples.filter(pred).length;
  return hits / samples.length >= 0.7;
}

function isRising(samples: Sample[], pred: (sample: Sample) => boolean): boolean {
  if (samples.length < 8 || !mostlySamples(samples, pred)) return false;
  const duration = samples[samples.length - 1].t - samples[0].t;
  if (duration < 380) return false;
  const start = mean(samples.slice(0, 3).map((sample) => sample.y));
  const end = mean(samples.slice(-3).map((sample) => sample.y));
  if (start - end < 0.05) return false;
  let toward = 0;
  for (let i = 1; i < samples.length; i++) {
    if (samples[i].y <= samples[i - 1].y + 0.004) toward += 1;
  }
  return toward / (samples.length - 1) >= 0.65 && !isCircle(samples);
}

function reversals(values: number[]): number {
  let changes = 0;
  let previous = 0;
  for (let i = 1; i < values.length; i++) {
    const delta = values[i] - values[i - 1];
    if (Math.abs(delta) < 0.004) continue;
    const sign = Math.sign(delta);
    if (previous !== 0 && sign !== previous) changes += 1;
    previous = sign;
  }
  return changes;
}

function isWag(samples: Sample[], pred: (sample: Sample) => boolean, axis: "indexX" | "indexY" | "pinkyX" | "pinkyY"): boolean {
  if (samples.length < 8 || !mostlySamples(samples, pred)) return false;
  const duration = samples[samples.length - 1].t - samples[0].t;
  if (duration < 420) return false;
  const values = samples.map((sample) => sample[axis]);
  const span = Math.max(...values) - Math.min(...values);
  return span >= 0.05 && reversals(values) >= 2;
}

/** Index fingertip traces the three strokes of a Z. */
function isZPath(samples: Sample[]): boolean {
  if (samples.length < 12 || !mostlySamples(samples, (sample) => sample.indexOnly)) return false;
  const duration = samples[samples.length - 1].t - samples[0].t;
  if (duration < 500) return false;
  const third = Math.floor(samples.length / 3);
  const parts = [samples.slice(0, third), samples.slice(third, third * 2), samples.slice(third * 2)];
  const travel = (part: Sample[]) => ({
    x: part[part.length - 1].indexX - part[0].indexX,
    y: part[part.length - 1].indexY - part[0].indexY,
  });
  const [first, second, thirdPart] = parts.map(travel);
  return first.x > 0.03 && Math.abs(first.y) < 0.03 && second.x < -0.02 && second.y > 0.02 && thirdPart.x > 0.03 && Math.abs(thirdPart.y) < 0.035;
}

/** Pinky draws the hook of J: down, then to the side. */
function isJPath(samples: Sample[]): boolean {
  if (samples.length < 10 || !mostlySamples(samples, (sample) => sample.tag === Handshape.LetterI)) return false;
  const duration = samples[samples.length - 1].t - samples[0].t;
  if (duration < 420) return false;
  const mid = Math.floor(samples.length / 2);
  const drop = samples[mid].pinkyY - samples[0].pinkyY;
  const hook = Math.abs(samples[samples.length - 1].pinkyX - samples[mid].pinkyX);
  const lateDrop = Math.abs(samples[samples.length - 1].pinkyY - samples[mid].pinkyY);
  return drop > 0.04 && hook > 0.03 && lateDrop < hook;
}

function motionOnTrack(track: Track, now: number): { label: string; holds: (sample: Sample) => boolean } | null {
  const circle = windowSamples(track, now, CIRCLE_WINDOW_MS);
  if (isCircle(circle)) {
    if (mostly(circle, "open")) return { label: "Please", holds: (sample) => sample.shape === "open" };
    if (mostly(circle, "fist")) return { label: "Sorry", holds: (sample) => sample.shape === "fist" };
  }
  const recent = windowSamples(track, now, APPROACH_WINDOW_MS);
  if (isZPath(recent)) return { label: Handshape.LetterZ, holds: (sample) => sample.indexOnly };
  if (isJPath(recent)) return { label: Handshape.LetterJ, holds: (sample) => sample.tag === Handshape.LetterI };
  if (isWag(recent, (sample) => sample.indexOnly, "indexX")) {
    return { label: Handshape.Where, holds: (sample) => sample.indexOnly };
  }
  if (isWag(recent, (sample) => sample.tag === Handshape.LetterW, "indexY")) {
    return { label: Handshape.Water, holds: (sample) => sample.tag === Handshape.LetterW };
  }
  if (isRising(recent, (sample) => sample.tag === "More")) {
    return { label: Handshape.Eat, holds: (sample) => sample.tag === "More" };
  }
  if (isRising(recent, (sample) => sample.tag === Handshape.LetterC)) {
    return { label: Handshape.Drink, holds: (sample) => sample.tag === Handshape.LetterC };
  }
  if (isApproach(recent)) return { label: "ThankYou", holds: (sample) => sample.shape === "open" };
  return null;
}

class LabelStabilizer {
  private label: string | null = null;
  private confidence = 0;
  private pendingLabel: string | null = null;
  private pendingConfidence = 0;
  private pendingCount = 0;
  private pending = false;

  reset(): void {
    this.label = null;
    this.confidence = 0;
    this.pending = false;
    this.pendingCount = 0;
  }

  push(next: { label: string | null; confidence: number }): { label: string | null; confidence: number } {
    if (next.label === this.label) {
      this.pending = false;
      this.pendingCount = 0;
      // Smooth the score so one noisy frame doesn't drop it below the threshold.
      if (next.label) this.confidence = this.confidence * 0.6 + next.confidence * 0.4;
      return this.output();
    }
    if (this.pending && this.pendingLabel === next.label) {
      this.pendingCount += 1;
      this.pendingConfidence = next.confidence;
    } else {
      this.pending = true;
      this.pendingLabel = next.label;
      this.pendingConfidence = next.confidence;
      this.pendingCount = 1;
    }
    const needed = next.label === null ? CLEAR_FRAMES : SWITCH_FRAMES;
    if (this.pendingCount >= needed) {
      this.label = this.pendingLabel;
      this.confidence = this.pendingConfidence;
      this.pending = false;
      this.pendingCount = 0;
    }
    return this.output();
  }

  private output(): { label: string | null; confidence: number } {
    if (!this.label) return { label: null, confidence: 0 };
    return { label: this.label, confidence: this.confidence };
  }
}

/**
 * Turns a stream of hands into one label. Static shapes win over motion.
 * A recognized motion is held briefly so a one-second hold can complete,
 * then the similar built-in gesture (open palm, fist) is suppressed so it
 * is not added on the next frame.
 */
export class GestureTracker {
  private tracks: Track[] = [];
  private nextId = 1;
  private latch: Latch | null = null;
  private cooldownUntil = 0;
  private suppress = new Set<string>();
  private stabilizer = new LabelStabilizer();
  private lastNow = 0;

  reset(): void {
    this.tracks = [];
    this.nextId = 1;
    this.latch = null;
    this.cooldownUntil = 0;
    this.suppress.clear();
    this.stabilizer.reset();
    this.lastNow = 0;
  }

  decide(
    frames: HandFrame[],
    fallback: { label: string | null; confidence: number },
    now: number,
  ): { label: string | null; confidence: number } {
    if (this.lastNow !== 0 && (now < this.lastNow || now - this.lastNow > 500)) this.reset();
    this.lastNow = now;

    const hands = frames.map(analyzeHand).filter((hand): hand is AnalyzedHand => hand !== null);
    this.updateTracks(hands, now);
    this.tracks = this.tracks.filter((track) => now - track.lastT < 350);

    const staticSign = classifyStaticSign(hands);
    this.noteMotion(now);
    const motion = this.latched(now);
    // A moving C, W, or flat-O is DRINK, WATER, or EAT rather than the still handshape.
    const raw = motion ?? staticSign ?? this.fallback(fallback, now);
    return this.stabilizer.push(raw);
  }

  private updateTracks(hands: AnalyzedHand[], now: number): void {
    const used = new Set<number>();
    for (const hand of hands) {
      let best: Track | null = null;
      let bestDistance = 0.2;
      for (const track of this.tracks) {
        if (used.has(track.id)) continue;
        const distance = Math.hypot(track.lastX - hand.wrist.x, track.lastY - hand.wrist.y);
        if (distance < bestDistance) {
          best = track;
          bestDistance = distance;
        }
      }
      const track = best ?? {
        id: this.nextId++,
        samples: [],
        lastX: hand.wrist.x,
        lastY: hand.wrist.y,
        lastT: now,
      };
      if (!best) this.tracks.push(track);
      used.add(track.id);
      const one = classifyOneHand(hand);
      track.samples.push({
        t: now,
        x: hand.wrist.x,
        y: hand.wrist.y,
        indexX: hand.image[8].x,
        indexY: hand.image[8].y,
        pinkyX: hand.image[20].x,
        pinkyY: hand.image[20].y,
        palmWidth: hand.palmWidth,
        shape: hand.shape,
        tag: one?.label ?? (hand.flatO ? "More" : null),
        indexOnly: hand.indexOnly,
      });
      track.lastX = hand.wrist.x;
      track.lastY = hand.wrist.y;
      track.lastT = now;
      const cutoff = now - 1200;
      track.samples = track.samples.filter((sample) => sample.t >= cutoff);
    }
  }

  private noteMotion(now: number): void {
    let found: { label: string; trackId: number; holds: (sample: Sample) => boolean } | null = null;
    for (const track of this.tracks) {
      const motion = motionOnTrack(track, now);
      if (!motion) continue;
      if (!found || MOTION_RANK.indexOf(motion.label) < MOTION_RANK.indexOf(found.label)) {
        found = { label: motion.label, trackId: track.id, holds: motion.holds };
      }
    }
    if (!found) return;
    this.latch = { label: found.label, trackId: found.trackId, until: now + LATCH_MS, holds: found.holds };
    this.cooldownUntil = 0;
    this.suppress.clear();
  }

  private latched(now: number): { label: string; confidence: number } | null {
    const latch = this.latch;
    if (!latch) return null;
    if (now >= latch.until) {
      this.cooldownUntil = latch.until + COOLDOWN_MS;
      this.suppress = new Set(MOTION_BLOCKS[latch.label] ?? []);
      this.latch = null;
      return null;
    }
    const latest = this.latestSample(latch.trackId);
    return latest && latch.holds(latest) ? { label: latch.label, confidence: 0.9 } : null;
  }

  private latestSample(trackId: number): Sample | null {
    const track = this.tracks.find((item) => item.id === trackId);
    return track?.samples[track.samples.length - 1] ?? null;
  }

  private fallback(
    fallback: { label: string | null; confidence: number },
    now: number,
  ): { label: string | null; confidence: number } {
    if (fallback.label && now < this.cooldownUntil && this.suppress.has(fallback.label)) {
      return { label: null, confidence: 0 };
    }
    return fallback;
  }
}
