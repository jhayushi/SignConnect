import type { Point } from "./types";

export const Handshape = {
  LetterA: "LetterA",
  LetterB: "LetterB",
  LetterC: "LetterC",
  LetterD: "LetterD",
  LetterE: "LetterE",
  LetterF: "LetterF",
  LetterG: "LetterG",
  LetterH: "LetterH",
  LetterI: "LetterI",
  LetterJ: "LetterJ",
  LetterK: "LetterK",
  LetterL: "LetterL",
  LetterM: "LetterM",
  LetterN: "LetterN",
  LetterP: "LetterP",
  LetterQ: "LetterQ",
  LetterR: "LetterR",
  LetterT: "LetterT",
  LetterU: "LetterU",
  LetterW: "LetterW",
  LetterX: "LetterX",
  LetterY: "LetterY",
  LetterZ: "LetterZ",
  Number3: "Number3",
  Number4: "Number4",
  Number6: "Number6",
  Number7: "Number7",
  Number8: "Number8",
  Bad: "Bad",
  Eat: "Eat",
  Drink: "Drink",
  Where: "Where",
  Family: "Family",
  Water: "Water",
} as const;

type FingerName = "index" | "middle" | "ring" | "pinky";
type FingerState = "extended" | "curled" | "partial";

export interface HandshapeInput {
  pose: Point[];
  image: Point[];
  fingers: Record<FingerName, FingerState>;
  open: boolean;
  together: boolean;
  flatO: boolean;
  hShape: boolean;
  indexOnly: boolean;
}

export interface ClassifiedHandshape {
  label: string;
  confidence: number;
}

type Direction = "up" | "down" | "side";

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function palmOf(pose: Point[]): number {
  return Math.max(dist(pose[5], pose[17]), 1e-6);
}

function ratio(pose: Point[], index: number, other: number): number {
  return dist(pose[index], pose[other]) / palmOf(pose);
}

/** Thumb extended away from the palm, as in L or thumbs-up. */
function thumbIsOut(pose: Point[]): boolean {
  return ratio(pose, 4, 17) > 1.15;
}

/** Thumb tip sits beside the index knuckle (the A hand). */
function thumbBesideIndex(pose: Point[]): boolean {
  return ratio(pose, 4, 5) < 0.42 && ratio(pose, 4, 9) > 0.28 && !thumbIsOut(pose);
}

/** Thumb tip tucked between the index and middle knuckles (the T hand). */
function thumbInCrease(pose: Point[]): boolean {
  const palm = palmOf(pose);
  const mid = {
    x: (pose[5].x + pose[9].x) / 2,
    y: (pose[5].y + pose[9].y) / 2,
    z: (pose[5].z + pose[9].z) / 2,
    visibility: 1,
  };
  const toMid = dist(pose[4], mid) / palm;
  return toMid < 0.38 && toMid < ratio(pose, 4, 5) && !thumbIsOut(pose);
}

function thumbOn(pose: Point[], landmark: number, limit = 0.4): boolean {
  return ratio(pose, 4, landmark) <= limit;
}

function pointing(image: Point[]): Direction {
  // Index finger. Callers that read this have the index extended, so the
  // tip is far enough from the knuckle for the direction to be stable.
  const dx = image[8].x - image[5].x;
  const dy = image[8].y - image[5].y;
  // A fanned finger still counts as up or down when most of its travel is vertical.
  if (Math.abs(dy) > Math.abs(dx) * 0.55 && dy < 0) return "up";
  if (Math.abs(dy) > Math.abs(dx) * 0.55 && dy > 0) return "down";
  return "side";
}

function crossed(pose: Point[]): boolean {
  const tipDelta = pose[8].x - pose[12].x;
  const mcpDelta = pose[5].x - pose[9].x;
  return tipDelta * mcpDelta < 0 && ratio(pose, 8, 12) < 0.85;
}

function twoUp(hand: HandshapeInput): boolean {
  return (
    hand.fingers.index === "extended" &&
    hand.fingers.middle === "extended" &&
    hand.fingers.ring !== "extended" &&
    hand.fingers.pinky !== "extended"
  );
}

function hit(label: string, confidence = 0.88): ClassifiedHandshape {
  return { label, confidence };
}

/**
 * One-hand letters, numbers, and a few words.
 * Poses that match a canned MediaPipe gesture (open palm, fist, thumbs-up,
 * pointing up, victory, I-love-you) return null so those words are kept.
 */
export function classifyOneHand(hand: HandshapeInput): ClassifiedHandshape | null {
  const { pose, fingers: f } = hand;
  const up = (name: FingerName) => f[name] === "extended";
  const inPalm = (name: FingerName) => f[name] === "curled";
  const bent = (name: FingerName) => f[name] === "partial";
  const dir = pointing(hand.image);
  const out = thumbIsOut(pose);

  // I-love-you: thumb, index, and pinky out. Leave it for MediaPipe.
  if (up("index") && up("pinky") && inPalm("middle") && inPalm("ring") && out) return null;

  if (up("middle") && up("ring") && up("pinky") && !up("index") && thumbOn(pose, 8)) return hit(Handshape.LetterF);
  if (up("index") && up("middle") && up("ring") && !up("pinky") && thumbOn(pose, 20)) return hit(Handshape.Number6);
  if (up("index") && up("middle") && up("pinky") && !up("ring") && thumbOn(pose, 16)) return hit(Handshape.Number7);
  if (up("index") && up("ring") && up("pinky") && !up("middle") && thumbOn(pose, 12)) return hit(Handshape.Number8);

  if (twoUp(hand)) {
    if (crossed(pose)) return hit(Handshape.LetterR);
    const thumbBetween = thumbOn(pose, 6, 0.48) && thumbOn(pose, 10, 0.48);
    if (!hand.together && thumbBetween && dir === "down") return hit(Handshape.LetterP);
    if (!hand.together && thumbBetween && dir === "up") return hit(Handshape.LetterK);
    if (hand.together && !out && dir === "side") return hit(Handshape.LetterH);
    if (hand.together && !out && dir === "up") return hit(Handshape.LetterU);
    if (out && dir === "up") return hit(Handshape.Number3);
    return null;
  }

  if (up("index") && up("middle") && up("ring") && !up("pinky") && !thumbOn(pose, 20)) return hit(Handshape.LetterW);

  if (hand.open && hand.together && !out) return hit(Handshape.LetterB);
  if (hand.open && !hand.together && !out) return hit(Handshape.Number4);
  if (hand.open && out) return null;

  if (hand.indexOnly) {
    if (thumbOn(pose, 12, 0.2) && dir === "up") return hit(Handshape.LetterD);
    if (out && dir === "up" && !thumbOn(pose, 6, 0.35)) return hit(Handshape.LetterL);
    if (thumbOn(pose, 6, 0.35) && dir === "side") return hit(Handshape.LetterG);
    if (thumbOn(pose, 6, 0.35) && dir === "down") return hit(Handshape.LetterQ);
    return null;
  }

  if (up("pinky") && inPalm("index") && inPalm("middle") && inPalm("ring")) {
    return hit(out ? Handshape.LetterY : Handshape.LetterI);
  }

  if (bent("index") && inPalm("middle") && inPalm("ring") && inPalm("pinky") && !out) return hit(Handshape.LetterX);

  const allCurled = inPalm("index") && inPalm("middle") && inPalm("ring") && inPalm("pinky");
  if (allCurled && !out) {
    const tips = [8, 12, 16, 20];
    if (tips.every((tip) => thumbOn(pose, tip, 0.32)) && !hand.flatO) return hit(Handshape.LetterE);
    if (thumbBesideIndex(pose)) return hit(Handshape.LetterA);
    if (thumbInCrease(pose)) return hit(Handshape.LetterT);
    const overThree = thumbOn(pose, 6, 0.4) && thumbOn(pose, 10, 0.4) && thumbOn(pose, 14, 0.4);
    const overTwo = thumbOn(pose, 6, 0.34) && thumbOn(pose, 10, 0.34) && ratio(pose, 4, 14) > 0.45;
    if (overThree) return hit(Handshape.LetterM);
    if (overTwo) return hit(Handshape.LetterN);
    return null;
  }

  const allPartial = bent("index") && bent("middle") && bent("ring") && bent("pinky");
  if (allPartial && !hand.flatO && out && !tipsOnThumb(pose)) return hit(Handshape.LetterC);

  return null;
}

function tipsOnThumb(pose: Point[]): boolean {
  return [8, 12, 16, 20].every((tip) => thumbOn(pose, tip, 0.48));
}

export function handshapeFacts(hand: HandshapeInput): string {
  const pose = hand.pose;
  const bits = [5, 6, 8, 9, 10, 12, 14, 16, 20].map((index) => `${index}:${ratio(pose, 4, index).toFixed(2)}`);
  return `dir=${pointing(hand.image)} out=${thumbIsOut(pose)} beside=${thumbBesideIndex(pose)} crease=${thumbInCrease(pose)} thumb[${bits.join(" ")}]`;
}
