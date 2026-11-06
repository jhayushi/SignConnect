import { analyzeHand, classifyStaticSign } from "./landmarkSigns";
import { P, buildLocal, centroid, hand, type HandOptions } from "./syntheticHand";

export interface FixtureHand {
  landmarks: { x: number; y: number; z: number; visibility: number }[];
  worldLandmarks: { x: number; y: number; z: number; visibility: number }[];
  handedness: "Left" | "Right" | "Unknown";
}

/** Synthetic kinematic samples. These are not webcam recordings. */
export interface FixtureSample {
  label: string | null;
  source: "synthetic";
  note: string;
  hands: FixtureHand[];
}

const SINGLE: { label: string | null; note: string; opts: HandOptions }[] = [
  { label: null, note: "reserved for Open_Palm / HELLO", opts: { curls: [0, 0, 0, 0], thumb: "out" } },
  { label: null, note: "reserved for Thumb_Up / YES", opts: { curls: [1, 1, 1, 1], thumb: "out" } },
  { label: null, note: "reserved for Closed_Fist / STOP", opts: { curls: [1, 1, 1, 1], thumb: "across" } },
  { label: null, note: "reserved for Pointing_Up / WAIT", opts: { curls: [0, 1, 1, 1], thumb: "across" } },
  { label: null, note: "reserved for Victory / PEACE", opts: { curls: [0, 0, 1, 1], thumb: "across", spread: 1.2 } },
  { label: null, note: "reserved for ILoveYou", opts: { curls: [0, 1, 1, 0], thumb: "out" } },
  { label: "More", note: "flat O", opts: { curls: [0.62, 0.62, 0.62, 0.62], thumb: "pinch" } },
  { label: "Bad", note: "palm down", opts: { curls: [0, 0, 0, 0], thumb: "out", facing: "down" } },
  { label: "LetterA", note: "thumb beside index", opts: { curls: [1, 1, 1, 1], thumb: "side" } },
  { label: "LetterB", note: "flat together", opts: { curls: [0, 0, 0, 0], thumb: "across" } },
  { label: "LetterC", note: "curved", opts: { curls: [0.42, 0.42, 0.42, 0.42], thumb: "out" } },
  { label: "LetterD", note: "index up, thumb on middle", opts: { curls: [0, 1, 1, 1], thumb: "across", thumbOn: 12 } },
  { label: "LetterE", note: "gathered fingertips", opts: { curls: [1, 1, 1, 1], thumb: "across", gather: true } },
  { label: "LetterF", note: "ok sign", opts: { curls: [0.75, 0, 0, 0], thumb: "across", thumbOn: 8 } },
  { label: "LetterG", note: "sideways", opts: { curls: [0, 1, 1, 1], thumb: "along", point: "side" } },
  { label: "LetterH", note: "H to the side", opts: { curls: [0, 0, 1, 1], thumb: "across", point: "side" } },
  { label: "LetterI", note: "pinky", opts: { curls: [1, 1, 1, 0], thumb: "across" } },
  { label: "LetterK", note: "thumb in the V", opts: { curls: [0, 0, 1, 1], thumb: "v", spread: 0.9 } },
  { label: "LetterL", note: "L", opts: { curls: [0, 1, 1, 1], thumb: "out" } },
  { label: "LetterM", note: "three fingers over thumb", opts: { curls: [1, 1, 1, 1], thumb: "over3" } },
  { label: "LetterN", note: "two fingers over thumb", opts: { curls: [1, 1, 1, 1], thumb: "over2" } },
  { label: "LetterP", note: "K pointing down", opts: { curls: [0, 0, 1, 1], thumb: "v", spread: 0.9, point: "down" } },
  { label: "LetterQ", note: "G pointing down", opts: { curls: [0, 1, 1, 1], thumb: "along", point: "down" } },
  { label: "LetterR", note: "crossed", opts: { curls: [0, 0, 1, 1], thumb: "across", cross: true } },
  { label: "LetterT", note: "thumb in the crease", opts: { curls: [1, 1, 1, 1], thumb: "crease" } },
  { label: "LetterU", note: "together up", opts: { curls: [0, 0, 1, 1], thumb: "across" } },
  { label: "LetterW", note: "three fingers", opts: { curls: [0, 0, 0, 1], thumb: "across", spread: 0.6 } },
  { label: "LetterX", note: "hooked index", opts: { curls: [0.55, 1, 1, 1], thumb: "across" } },
  { label: "LetterY", note: "thumb and pinky", opts: { curls: [1, 1, 1, 0], thumb: "out" } },
  { label: "Number3", note: "three extended", opts: { curls: [0, 0, 1, 1], thumb: "out", spread: 0.8 } },
  { label: "Number4", note: "four spread", opts: { curls: [0, 0, 0, 0], thumb: "across", spread: 1 } },
  { label: "Number6", note: "thumb on pinky", opts: { curls: [0, 0, 0, 1], thumb: "across", thumbOn: 20 } },
  { label: "Number7", note: "thumb on ring", opts: { curls: [0, 0, 1, 0], thumb: "across", thumbOn: 16 } },
  { label: "Number8", note: "thumb on middle", opts: { curls: [0, 1, 0, 0], thumb: "across", thumbOn: 12 } },
];

function frameOf(opts: HandOptions): FixtureHand {
  const frame = hand(opts);
  return {
    landmarks: frame.landmarks,
    worldLandmarks: frame.worldLandmarks ?? frame.landmarks,
    handedness: frame.handedness ?? "Unknown",
  };
}

function variants(opts: HandOptions): HandOptions[] {
  return [
    opts,
    { ...opts, side: "Left", at: opts.at ?? P(0.42, 0.5, 0) },
    { ...opts, scale: opts.scale ?? 1.15, at: opts.at ?? P(0.58, 0.62, 0) },
  ];
}

function twoHandSamples(): FixtureSample[] {
  const samples: FixtureSample[] = [];
  const push = (label: string | null, note: string, hands: FixtureHand[]) => {
    samples.push({ label, source: "synthetic", note, hands });
  };

  push("What", "palms up, apart", [
    frameOf({ curls: [0, 0, 0, 0], thumb: "out", facing: "up", side: "Right", at: P(0.32, 0.5, 0) }),
    frameOf({ curls: [0, 0, 0, 0], thumb: "out", facing: "up", side: "Left", at: P(0.68, 0.5, 0) }),
  ]);
  push("Done", "palms down, apart", [
    frameOf({ curls: [0, 0, 0, 0], thumb: "out", facing: "down", side: "Right", at: P(0.32, 0.5, 0) }),
    frameOf({ curls: [0, 0, 0, 0], thumb: "out", facing: "down", side: "Left", at: P(0.68, 0.52, 0) }),
  ]);
  const base = analyzeHand(hand({ curls: [0, 0, 0, 0], thumb: "out", facing: "up", at: P(0.48, 0.58, 0) }));
  if (!base) throw new Error("help base hand missing");
  push("Help", "fist on an open palm", [
    frameOf({ curls: [0, 0, 0, 0], thumb: "out", facing: "up", at: P(0.48, 0.58, 0) }),
    frameOf({ curls: [1, 1, 1, 1], thumb: "out", side: "Left", at: base.palmCenter }),
  ]);
  push("Love", "fists crossed", [
    frameOf({ curls: [1, 1, 1, 1], thumb: "across", at: P(0.46, 0.5, 0) }),
    frameOf({ curls: [1, 1, 1, 1], thumb: "across", side: "Left", at: P(0.5, 0.5, 0) }),
  ]);

  const rightIndex = hand({ curls: [0, 1, 1, 1], thumb: "across", side: "Right", at: P(0.42, 0.6, 0) });
  const leftLocal = buildLocal([0, 1, 1, 1], "across");
  push("Friend", "index fingers touching", [
    {
      landmarks: rightIndex.landmarks,
      worldLandmarks: rightIndex.worldLandmarks ?? rightIndex.landmarks,
      handedness: "Right",
    },
    frameOf({
      curls: [0, 1, 1, 1],
      thumb: "across",
      side: "Left",
      at: P(rightIndex.landmarks[8].x + leftLocal[8].x, rightIndex.landmarks[8].y - leftLocal[8].y, 0),
    }),
  ]);

  const rightH = hand({ curls: [0, 0, 1, 1], thumb: "across", at: P(0.4, 0.62, 0) });
  const leftHLocal = buildLocal([0, 0, 1, 1], "across");
  push("Name", "H hands touching", [
    {
      landmarks: rightH.landmarks,
      worldLandmarks: rightH.worldLandmarks ?? rightH.landmarks,
      handedness: "Right",
    },
    frameOf({
      curls: [0, 0, 1, 1],
      thumb: "across",
      side: "Left",
      at: P(rightH.landmarks[8].x + leftHLocal[8].x, rightH.landmarks[8].y - leftHLocal[8].y, 0),
    }),
  ]);
  push("Family", "two F hands", [
    frameOf({ curls: [0.75, 0, 0, 0], thumb: "across", thumbOn: 8, at: P(0.4, 0.55, 0) }),
    frameOf({ curls: [0.75, 0, 0, 0], thumb: "across", thumbOn: 8, side: "Left", at: P(0.55, 0.55, 0) }),
  ]);

  const receiver = hand({ curls: [0, 0, 0, 0], thumb: "out", facing: "up", at: P(0.5, 0.62, 0) });
  const receiverHand = analyzeHand(receiver);
  const giverLocal = buildLocal([0, 0, 0, 0], "out");
  const giverTips = centroid([giverLocal[8], giverLocal[12], giverLocal[16]]);
  if (!receiverHand) throw new Error("good receiver missing");
  push("Good", "fingertips in the other palm", [
    {
      landmarks: receiver.landmarks,
      worldLandmarks: receiver.worldLandmarks ?? receiver.landmarks,
      handedness: "Right",
    },
    frameOf({
      curls: [0, 0, 0, 0],
      thumb: "out",
      side: "Left",
      at: P(receiverHand.palmCenter.x + giverTips.x, receiverHand.palmCenter.y - giverTips.y, 0),
    }),
  ]);
  return samples;
}

/** Labeled synthetic hands. Each note says these are generated, not recorded. */
export function buildSyntheticFixtures(): FixtureSample[] {
  const samples: FixtureSample[] = [];
  for (const pose of SINGLE) {
    for (const opts of variants(pose.opts)) {
      samples.push({
        label: pose.label,
        source: "synthetic",
        note: `${pose.note}. Generated by the kinematic model in syntheticHand.ts, not recorded from a camera.`,
        hands: [frameOf(opts)],
      });
    }
  }
  for (const sample of twoHandSamples()) {
    samples.push({
      ...sample,
      note: `${sample.note}. Generated by the kinematic model in syntheticHand.ts, not recorded from a camera.`,
    });
  }
  return samples;
}

export function predictedLabel(sample: FixtureSample): string | null {
  const hands = sample.hands.map((handFrame) => {
    const analyzed = analyzeHand({
      landmarks: handFrame.landmarks,
      worldLandmarks: handFrame.worldLandmarks,
      handedness: handFrame.handedness,
    });
    if (!analyzed) throw new Error("fixture hand did not analyze");
    return analyzed;
  });
  return classifyStaticSign(hands)?.label ?? null;
}
