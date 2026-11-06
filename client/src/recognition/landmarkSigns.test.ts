import type { Point } from "./types";
import { handshapeFacts } from "./handshapes";
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

function rotZ(p: Point, rad: number): Point {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return P(p.x * c - p.y * s, p.x * s + p.y * c, p.z);
}

type Thumb = "out" | "across" | "pinch" | "side" | "crease" | "v" | "along" | "bundle" | "over3" | "over2";
type Facing = "camera" | "up" | "down";
type Pointing = "up" | "side" | "down";

function buildLocal(
  curls: [number, number, number, number],
  thumb: Thumb,
  spread = 0,
  cross = false,
): Point[] {
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
  } else if (thumb === "side") {
    pts[3] = P(-0.026, -0.03, 0);
    pts[4] = P(-0.03, -0.05, 0.008);
  } else if (thumb === "crease") {
    pts[4] = centroid([pts[5], pts[9]]);
    pts[3] = centroid([pts[2], pts[4]]);
  } else if (thumb === "v") {
    pts[4] = add(centroid([pts[6], pts[10]]), P(0, 0.008, -0.004));
    pts[3] = centroid([pts[2], pts[4]]);
  } else if (thumb === "along") {
    pts[4] = add(pts[6], P(-0.01, 0.002, -0.004));
    pts[3] = centroid([pts[2], pts[4]]);
  } else if (thumb === "over3") {
    pts[4] = add(centroid([pts[6], pts[10], pts[14]]), P(0, 0.003, 0.004));
    pts[3] = centroid([pts[2], pts[4]]);
  } else if (thumb === "over2") {
    pts[4] = add(centroid([pts[6], pts[10]]), P(-0.004, 0.003, 0.004));
    pts[3] = centroid([pts[2], pts[4]]);
  } else if (thumb === "bundle") {
    pts[4] = add(centroid([pts[8], pts[12], pts[16], pts[20]]), P(0.002, 0.002, 0));
    pts[3] = centroid([pts[2], pts[4]]);
  } else {
    const tip = centroid([pts[8], pts[12], pts[16]]);
    pts[4] = add(tip, P(0.003, 0.004, 0.002));
    pts[3] = centroid([pts[2], pts[4]]);
  }
  if (cross) {
    const indexX = pts[8].x;
    pts[8] = P(pts[12].x, pts[8].y, pts[8].z);
    pts[12] = P(indexX, pts[12].y, pts[12].z);
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
  opts: { facing?: Facing; side?: "Left" | "Right"; at?: Point; scale?: number; point?: Pointing },
): Point[] {
  const facing = opts.facing ?? "camera";
  const angle = facing === "up" ? -Math.PI / 2 : facing === "down" ? Math.PI / 2 : 0;
  const spin = opts.point === "down" ? Math.PI : opts.point === "side" ? Math.PI / 2 : 0;
  const k = opts.scale ?? 1;
  const at = opts.at ?? P(0.5, 0.55, 0);
  return local.map((p) => {
    let q = mul(rotX(rotZ(p, spin), angle), k);
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
  point?: Pointing;
  cross?: boolean;
  /** Place the thumb tip on this landmark after the fingers are posed. */
  thumbOn?: number;
  /** Pull the fingertips together, as in E. */
  gather?: boolean;
}): HandFrame {
  const local = buildLocal(opts.curls, opts.thumb ?? "out", opts.spread ?? 0, opts.cross ?? false);
  if (opts.gather) {
    const center = centroid([local[8], local[12], local[16], local[20]]);
    for (const tip of [8, 12, 16, 20]) {
      local[tip] = add(center, mul(P(local[tip].x - center.x, local[tip].y - center.y, local[tip].z - center.z), 0.2));
    }
    local[4] = add(center, P(0.001, 0.001, 0));
    local[3] = centroid([local[2], local[4]]);
  }
  if (opts.thumbOn !== undefined) {
    local[4] = add(local[opts.thumbOn], P(0.002, 0.002, 0.001));
    local[3] = centroid([local[2], local[4]]);
  }
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
      `expected ${label ?? "none"}, got ${got?.label ?? "none"}\n${hands
        .map((hand) => `${describeHand(hand)} ${handshapeFacts(hand)}`)
        .join("\n")}`,
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
  expectStatic([openHand({ facing: "down" })], "Bad");

  const letters: { label: string; frame: HandFrame }[] = [
    { label: "LetterA", frame: hand({ curls: [1, 1, 1, 1], thumb: "side" }) },
    { label: "LetterB", frame: hand({ curls: [0, 0, 0, 0], thumb: "across" }) },
    { label: "LetterC", frame: hand({ curls: [0.42, 0.42, 0.42, 0.42], thumb: "out" }) },
    { label: "LetterD", frame: hand({ curls: [0, 1, 1, 1], thumb: "across", thumbOn: 12 }) },
    { label: "LetterE", frame: hand({ curls: [1, 1, 1, 1], thumb: "across", gather: true }) },
    { label: "LetterF", frame: hand({ curls: [0.75, 0, 0, 0], thumb: "across", thumbOn: 8 }) },
    { label: "LetterG", frame: hand({ curls: [0, 1, 1, 1], thumb: "along", point: "side" }) },
    { label: "LetterH", frame: hand({ curls: [0, 0, 1, 1], thumb: "across", point: "side" }) },
    { label: "LetterI", frame: hand({ curls: [1, 1, 1, 0], thumb: "across" }) },
    { label: "LetterK", frame: hand({ curls: [0, 0, 1, 1], thumb: "v", spread: 0.9 }) },
    { label: "LetterL", frame: hand({ curls: [0, 1, 1, 1], thumb: "out" }) },
    { label: "LetterM", frame: hand({ curls: [1, 1, 1, 1], thumb: "over3" }) },
    { label: "LetterN", frame: hand({ curls: [1, 1, 1, 1], thumb: "over2" }) },
    { label: "LetterP", frame: hand({ curls: [0, 0, 1, 1], thumb: "v", spread: 0.9, point: "down" }) },
    { label: "LetterQ", frame: hand({ curls: [0, 1, 1, 1], thumb: "along", point: "down" }) },
    { label: "LetterR", frame: hand({ curls: [0, 0, 1, 1], thumb: "across", cross: true }) },
    { label: "LetterT", frame: hand({ curls: [1, 1, 1, 1], thumb: "crease" }) },
    { label: "LetterU", frame: hand({ curls: [0, 0, 1, 1], thumb: "across" }) },
    { label: "LetterW", frame: hand({ curls: [0, 0, 0, 1], thumb: "across", spread: 0.6 }) },
    { label: "LetterX", frame: hand({ curls: [0.55, 1, 1, 1], thumb: "across" }) },
    { label: "LetterY", frame: hand({ curls: [1, 1, 1, 0], thumb: "out" }) },
    { label: "Number3", frame: hand({ curls: [0, 0, 1, 1], thumb: "out", spread: 0.8 }) },
    { label: "Number4", frame: hand({ curls: [0, 0, 0, 0], thumb: "across", spread: 1 }) },
    { label: "Number6", frame: hand({ curls: [0, 0, 0, 1], thumb: "across", thumbOn: 20 }) },
    { label: "Number7", frame: hand({ curls: [0, 0, 1, 0], thumb: "across", thumbOn: 16 }) },
    { label: "Number8", frame: hand({ curls: [0, 1, 0, 0], thumb: "across", thumbOn: 12 }) },
  ];
  for (const { label, frame } of letters) expectStatic([frame], label);

  const fRight = hand({ curls: [0.75, 0, 0, 0], thumb: "across", thumbOn: 8, at: P(0.4, 0.55, 0) });
  const fLeft = hand({
    curls: [0.75, 0, 0, 0],
    thumb: "across",
    thumbOn: 8,
    side: "Left",
    at: P(0.55, 0.55, 0),
  });
  expectStatic([fRight, fLeft], "Family");

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

  const play = (
    make: (i: number, count: number) => HandFrame,
    count: number,
    fallback: { label: string | null; confidence: number },
  ): string | null => {
    const tracker = new GestureTracker();
    let label: string | null = null;
    for (let i = 0; i < count; i++) {
      label = tracker.decide([make(i, count)], fallback, 20000 + i * 40).label;
    }
    return label;
  };

  const rising = (pose: Parameters<typeof hand>[0]) =>
    play((i) => hand({ ...pose, at: P(0.5, 0.72 - i * 0.012, 0) }), 18, { label: null, confidence: 0 });
  if (rising({ curls: [0.62, 0.62, 0.62, 0.62], thumb: "pinch" }) !== "Eat") {
    throw new Error("flat-O moving up should be EAT");
  }
  if (rising({ curls: [0.42, 0.42, 0.42, 0.42], thumb: "out" }) !== "Drink") {
    throw new Error("C hand moving up should be DRINK");
  }

  const where = play(
    (i) => hand({ curls: [0, 1, 1, 1], thumb: "across", at: P(0.45 + Math.sin(i / 2) * 0.05, 0.5, 0) }),
    18,
    { label: "Pointing_Up", confidence: 0.9 },
  );
  if (where !== "Where") throw new Error(`index wag should be WHERE, got ${where}`);

  const water = play(
    (i) => hand({ curls: [0, 0, 0, 1], thumb: "across", spread: 0.6, at: P(0.5, 0.5 + Math.sin(i / 2) * 0.045, 0) }),
    18,
    { label: null, confidence: 0 },
  );
  if (water !== "Water") throw new Error(`W hand bobbing should be WATER, got ${water}`);

  const zed = play(
    (i, count) => {
      const t = i / (count - 1);
      const at = t < 0.34 ? P(0.35 + (t / 0.34) * 0.16, 0.4, 0)
        : t < 0.67 ? P(0.51 - ((t - 0.34) / 0.33) * 0.12, 0.4 + ((t - 0.34) / 0.33) * 0.12, 0)
        : P(0.39 + ((t - 0.67) / 0.33) * 0.16, 0.52, 0);
      return hand({ curls: [0, 1, 1, 1], thumb: "across", at });
    },
    21,
    { label: "Pointing_Up", confidence: 0.9 },
  );
  if (zed !== "LetterZ") throw new Error(`index Z should be Z, got ${zed}`);

  const jay = play(
    (i, count) => {
      const t = i / (count - 1);
      const at = t < 0.55 ? P(0.55, 0.32 + (t / 0.55) * 0.16, 0) : P(0.55 - ((t - 0.55) / 0.45) * 0.14, 0.48, 0);
      return hand({ curls: [1, 1, 1, 0], thumb: "across", at });
    },
    18,
    { label: null, confidence: 0 },
  );
  if (jay !== "LetterJ") throw new Error(`pinky hook should be J, got ${jay}`);

  const kept: { frame: HandFrame; label: string }[] = [
    { frame: openHand(), label: "Open_Palm" },
    { frame: hand({ curls: [1, 1, 1, 1], thumb: "out" }), label: "Thumb_Up" },
    { frame: fist(), label: "Closed_Fist" },
    { frame: hand({ curls: [0, 1, 1, 1], thumb: "across" }), label: "Pointing_Up" },
    { frame: hand({ curls: [0, 1, 1, 0], thumb: "out" }), label: "ILoveYou" },
    { frame: hand({ curls: [0, 0, 1, 1], thumb: "across", spread: 1.2 }), label: "Victory" },
  ];
  for (const { frame, label } of kept) {
    const got = play(() => frame, 6, { label, confidence: 0.96 });
    if (got !== label) throw new Error(`${label} was overridden by ${got}`);
  }

  const words = wordsFromSpeech("  Hello, I'm fine! ");
  if (words.join(" ") !== "HELLO I'M FINE") throw new Error(`speech words: ${words.join(" ")}`);
  if (wordsFromSpeech("...").length !== 0) throw new Error("punctuation should add no words");

  console.log("landmark signs ok");
}

run();
