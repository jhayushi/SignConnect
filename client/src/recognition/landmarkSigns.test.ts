import type { Point } from "./types";
import {
  GestureTracker,
  analyzeHand,
  classifyStaticSign,
  describeHand,
  type HandFrame,
} from "./landmarkSigns";
import { chooseCannedGesture } from "./mediaPipeRecognizer";
import { wordsFromSpeech } from "../sentence/sentenceBuilder";

function P(x: number, y: number, z = 0): Point {
  return { x, y, z, visibility: 1 };
}

function add(a: Point, b: Point): Point {
  return P(a.x + b.x, a.y + b.y, a.z + b.z);
}

function mul(a: Point, k: number): Point {
  return P(a.x * k, a.y * k, a.z * k);
}

function rotX(p: Point, rad: number): Point {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return P(p.x, p.y * c - p.z * s, p.y * s + p.z * c);
}

type Thumb = "out" | "across" | "pinch";
type Facing = "camera" | "up" | "down";

function buildLocal(curls: [number, number, number, number], thumb: Thumb, spread = 0): Point[] {
  const pts = Array.from({ length: 21 }, () => P(0, 0, 0));
  const mcps = [
    P(-0.022 - spread * 0.01, -0.055, 0),
    P(-0.004, -0.062, 0),
    P(0.014, -0.056, 0),
    P(0.03 + spread * 0.01, -0.046, 0),
  ];
  const bases = [5, 9, 13, 17];
  const fan = [-spread, -spread * 0.2, spread * 0.2, spread];
  for (let f = 0; f < 4; f++) {
    pts[bases[f]] = mcps[f];
    const segs = [0.026, 0.018, 0.015];
    let pos = mcps[f];
    let angle = 0;
    for (let s = 0; s < 3; s++) {
      angle += curls[f] * Math.PI * 0.55;
      const dir = normalize(P(fan[f] * (1 - curls[f] * 0.5), -Math.cos(angle), -Math.sin(angle)));
      pos = add(pos, mul(dir, segs[s]));
      pts[bases[f] + 1 + s] = pos;
    }
  }
  pts[1] = P(-0.012, -0.012, 0);
  pts[2] = P(-0.028, -0.02, 0);
  if (thumb === "out") {
    pts[3] = P(-0.048, -0.012, 0);
    pts[4] = P(-0.066, 0.004, 0);
  } else if (thumb === "across") {
    pts[3] = P(-0.01, -0.03, -0.005);
    pts[4] = P(0.008, -0.04, -0.008);
  } else {
    const tip = centroid([pts[8], pts[12], pts[16]]);
    pts[4] = add(tip, P(0.004, 0.005, 0.002));
    pts[3] = centroid([pts[2], pts[4]]);
  }
  return pts;
}

function normalize(p: Point): Point {
  const m = Math.hypot(p.x, p.y, p.z) || 1;
  return mul(p, 1 / m);
}

function centroid(points: Point[]): Point {
  const n = points.length || 1;
  return mul(
    points.reduce((sum, p) => add(sum, p), P(0, 0, 0)),
    1 / n,
  );
}

function place(
  local: Point[],
  opts: { facing?: Facing; side?: "Left" | "Right"; at?: Point; scale?: number },
): Point[] {
  const facing = opts.facing ?? "camera";
  const angle = facing === "up" ? -Math.PI / 2 : facing === "down" ? Math.PI / 2 : 0;
  const k = opts.scale ?? 1;
  const at = opts.at ?? P(0.5, 0.55, 0);
  return local.map((p) => {
    let q = mul(rotX(p, angle), k);
    if (opts.side === "Left") q = P(-q.x, q.y, q.z);
    return add(q, at);
  });
}

function hand(opts: {
  curls: [number, number, number, number];
  thumb?: Thumb;
  facing?: Facing;
  side?: "Left" | "Right";
  at?: Point;
  scale?: number;
  spread?: number;
}): HandFrame {
  const local = buildLocal(opts.curls, opts.thumb ?? "out", opts.spread ?? 0);
  const side = opts.side ?? "Right";
  return {
    landmarks: place(local, opts),
    worldLandmarks: local,
    handedness: side,
  };
}

function analyzed(frames: HandFrame[]) {
  return frames.map((frame) => {
    const result = analyzeHand(frame);
    if (!result) throw new Error("hand did not analyze");
    return result;
  });
}

function expectStatic(frames: HandFrame[], label: string | null): void {
  const hands = analyzed(frames);
  const got = classifyStaticSign(hands);
  if ((got?.label ?? null) !== label) {
    throw new Error(
      `expected ${label ?? "none"}, got ${got?.label ?? "none"}\n${hands.map(describeHand).join("\n")}`,
    );
  }
  if (got && got.confidence < 0.7) throw new Error(`${label} confidence ${got.confidence} is below 0.7`);
}

function spanHand(width: number): Point[] {
  const pts = Array.from({ length: 21 }, () => P(0, 0, 0));
  pts[17] = P(width, 0, 0);
  return pts;
}

function openHand(extra: Partial<Parameters<typeof hand>[0]> = {}): HandFrame {
  return hand({ curls: [0, 0, 0, 0], thumb: "out", ...extra });
}

function fist(extra: Partial<Parameters<typeof hand>[0]> = {}): HandFrame {
  return hand({ curls: [1, 1, 1, 1], thumb: "across", ...extra });
}

function feed(
  tracker: GestureTracker,
  frames: { at: number; hands: HandFrame[]; fallback?: { label: string | null; confidence: number } }[],
): string | null {
  let label: string | null = null;
  for (const frame of frames) {
    label = tracker.decide(
      frame.hands,
      frame.fallback ?? { label: null, confidence: 0 },
      frame.at,
    ).label;
  }
  return label;
}

function run(): void {
  expectStatic([openHand()], null);
  expectStatic([openHand({ side: "Left" })], null);
  expectStatic([fist()], null);
  expectStatic([hand({ curls: [1, 1, 1, 1], thumb: "out" })], null);
  expectStatic([hand({ curls: [0, 1, 1, 1], thumb: "across" })], null);
  expectStatic([hand({ curls: [0, 0, 1, 1], thumb: "across", spread: 1.2 })], null);
  expectStatic([hand({ curls: [0, 1, 1, 0], thumb: "out" })], null);

  const upA = openHand({ facing: "up", side: "Right", at: P(0.32, 0.5, 0) });
  const upB = openHand({ facing: "up", side: "Left", at: P(0.68, 0.5, 0) });
  expectStatic([upA, upB], "What");
  const downA = openHand({ facing: "down", side: "Right", at: P(0.32, 0.5, 0) });
  const downB = openHand({ facing: "down", side: "Left", at: P(0.68, 0.52, 0) });
  expectStatic([downA, downB], "Done");
  expectStatic(
    [openHand({ at: P(0.32, 0.5, 0) }), openHand({ side: "Left", at: P(0.68, 0.5, 0) })],
    null,
  );

  const base = analyzed([openHand({ facing: "up", at: P(0.48, 0.58, 0) })])[0];
  expectStatic(
    [
      openHand({ facing: "up", at: P(0.48, 0.58, 0) }),
      fist({ side: "Left", thumb: "out", at: base.palmCenter }),
    ],
    "Help",
  );
  expectStatic(
    [openHand({ facing: "up", at: P(0.3, 0.55, 0) }), fist({ side: "Left", at: P(0.7, 0.55, 0) })],
    null,
  );

  expectStatic([fist({ at: P(0.46, 0.5, 0) }), fist({ side: "Left", at: P(0.5, 0.5, 0) })], "Love");
  expectStatic([fist({ at: P(0.25, 0.5, 0) }), fist({ side: "Left", at: P(0.75, 0.5, 0) })], null);

  const flat = hand({ curls: [0.62, 0.62, 0.62, 0.62], thumb: "pinch" });
  expectStatic([flat], "More");
  expectStatic([openHand(), flat], "More");

  const rightIndex = hand({ curls: [0, 1, 1, 1], thumb: "across", side: "Right", at: P(0.42, 0.6, 0) });
  const rightTip = rightIndex.landmarks[8];
  const leftLocal = buildLocal([0, 1, 1, 1], "across");
  const leftTip = leftLocal[8];
  const leftIndex = hand({
    curls: [0, 1, 1, 1],
    thumb: "across",
    side: "Left",
    at: P(rightTip.x + leftTip.x, rightTip.y - leftTip.y, 0),
  });
  expectStatic([rightIndex, leftIndex], "Friend");

  const rightH = hand({ curls: [0, 0, 1, 1], thumb: "across", at: P(0.4, 0.62, 0) });
  const hTip = rightH.landmarks[8];
  const leftHLocal = buildLocal([0, 0, 1, 1], "across");
  const leftH = hand({
    curls: [0, 0, 1, 1],
    thumb: "across",
    side: "Left",
    at: P(hTip.x + leftHLocal[8].x, hTip.y - leftHLocal[8].y, 0),
  });
  expectStatic([rightH, leftH], "Name");
  const spreadA = hand({ curls: [0, 0, 1, 1], spread: 1.4, at: P(0.4, 0.62, 0) });
  const spreadB = hand({
    curls: [0, 0, 1, 1],
    spread: 1.4,
    side: "Left",
    at: P(0.48, 0.62, 0),
  });
  expectStatic([spreadA, spreadB], null);

  const receiver = openHand({ facing: "up", at: P(0.5, 0.62, 0) });
  const receiverHand = analyzed([receiver])[0];
  const giverLocal = buildLocal([0, 0, 0, 0], "out");
  const giverTips = centroid([giverLocal[8], giverLocal[12], giverLocal[16]]);
  const giver = openHand({
    side: "Left",
    at: P(receiverHand.palmCenter.x + giverTips.x, receiverHand.palmCenter.y - giverTips.y, 0),
  });
  expectStatic([receiver, giver], "Good");

  const still = new GestureTracker();
  const stillLabels = new Set<string | null>();
  for (let i = 0; i < 20; i++) {
    stillLabels.add(
      still.decide([openHand()], { label: "Open_Palm", confidence: 0.95 }, 1000 + i * 33).label,
    );
  }
  if (stillLabels.has("Please") || stillLabels.has("ThankYou") || stillLabels.has("Sorry")) {
    throw new Error(`still hand produced a motion sign: ${[...stillLabels].join(",")}`);
  }
  if (![...stillLabels].includes("Open_Palm")) throw new Error("still open hand never settled on Open_Palm");

  const circle = new GestureTracker();
  let circleLabel: string | null = null;
  for (let i = 0; i < 28; i++) {
    const angle = (i / 16) * Math.PI * 2;
    circleLabel = circle.decide(
      [openHand({ at: P(0.5 + Math.cos(angle) * 0.07, 0.45 + Math.sin(angle) * 0.07, 0) })],
      { label: "Open_Palm", confidence: 0.92 },
      2000 + i * 33,
    ).label;
  }
  if (circleLabel !== "Please") throw new Error(`circle ended as ${circleLabel}, expected Please`);

  const fistCircle = new GestureTracker();
  let sorryLabel: string | null = null;
  for (let i = 0; i < 28; i++) {
    const angle = (i / 16) * Math.PI * 2;
    sorryLabel = fistCircle.decide(
      [fist({ at: P(0.48 + Math.cos(angle) * 0.065, 0.5 + Math.sin(angle) * 0.065, 0) })],
      { label: "Closed_Fist", confidence: 0.9 },
      3000 + i * 33,
    ).label;
  }
  if (sorryLabel !== "Sorry") throw new Error(`fist circle ended as ${sorryLabel}, expected Sorry`);

  const approach = new GestureTracker();
  let thankLabel: string | null = null;
  for (let i = 0; i < 22; i++) {
    thankLabel = approach.decide(
      [openHand({ scale: 1 + i * 0.025 })],
      { label: "Open_Palm", confidence: 0.9 },
      4000 + i * 35,
    ).label;
  }
  if (thankLabel !== "ThankYou") throw new Error(`approach ended as ${thankLabel}, expected ThankYou`);

  for (let i = 0; i < 8; i++) {
    thankLabel = approach.decide(
      [openHand({ scale: 1.5 })],
      { label: "Open_Palm", confidence: 0.9 },
      4000 + 22 * 35 + i * 40,
    ).label;
  }
  if (thankLabel !== "ThankYou") throw new Error(`held approach should stay ThankYou, got ${thankLabel}`);

  let after: string | null = thankLabel;
  for (let i = 0; i < 80; i++) {
    after = approach.decide(
      [openHand({ scale: 1.5 })],
      { label: "Open_Palm", confidence: 0.9 },
      5100 + i * 40,
    ).label;
  }
  if (after !== "Open_Palm") throw new Error(`thank-you should release back to Open_Palm, got ${after}`);

  const helpTracker = new GestureTracker();
  const helped = feed(
    helpTracker,
    Array.from({ length: 5 }, (_, i) => ({
      at: 6000 + i * 33,
      hands: [
        openHand({ facing: "up", at: P(0.48, 0.58, 0) }),
        fist({ side: "Left", thumb: "out", at: base.palmCenter }),
      ],
      fallback: { label: "Open_Palm", confidence: 0.88 },
    })),
  );
  if (helped !== "Help") throw new Error(`two-hand help settled as ${helped}`);

  const wide = spanHand(0.12);
  const narrow = spanHand(0.04);
  const canned = (
    name: string,
    score: number,
  ): { categoryName: string; score: number; index: number; displayName: string }[] => [
    { categoryName: name, score, index: -1, displayName: "" },
  ];
  const helloOverFist = chooseCannedGesture([canned("Open_Palm", 0.8), canned("Closed_Fist", 0.95)], [wide, narrow]);
  if (helloOverFist.label !== "Open_Palm") throw new Error(`larger palm should win, got ${helloOverFist.label}`);
  const yesOverPalm = chooseCannedGesture([canned("Open_Palm", 0.9), canned("Thumb_Up", 0.86)], [wide, narrow]);
  if (yesOverPalm.label !== "Thumb_Up") throw new Error(`thumbs up should win, got ${yesOverPalm.label}`);
  const weakYes = chooseCannedGesture([canned("Open_Palm", 0.9), canned("Thumb_Up", 0.4)], [wide, narrow]);
  if (weakYes.label !== "Open_Palm") throw new Error(`weak thumbs up should not win, got ${weakYes.label}`);

  const words = wordsFromSpeech("  Hello, I'm fine! ");
  if (words.join(" ") !== "HELLO I'M FINE") throw new Error(`speech words: ${words.join(" ")}`);
  if (wordsFromSpeech("...").length !== 0) throw new Error("punctuation should add no words");

  console.log("landmark signs ok");
}

run();
