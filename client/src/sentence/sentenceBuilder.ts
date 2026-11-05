// Pure logic that turns a stream of per-frame predictions into a sentence.
// Rules:
//   1. Ignore predictions below `minConfidence`.
//   2. A word is committed only after it is held steadily for `holdMs`.
//   3. The same word can't be committed again until the hand leaves or changes
//      sign for at least `releaseMs` (so brief flickers don't cause duplicates).

export interface BuilderConfig {
  minConfidence: number;
  holdMs: number;
  releaseMs: number;
}

export const DEFAULT_CONFIG: BuilderConfig = {
  minConfidence: 0.7,
  holdMs: 1000,
  releaseMs: 400,
};

export interface BuilderState {
  words: string[];
  candidate: string | null;
  candidateSince: number;
  locked: string | null;
  lockedLastSeen: number;
}

export const INITIAL_STATE: BuilderState = {
  words: [],
  candidate: null,
  candidateSince: 0,
  locked: null,
  lockedLastSeen: 0,
};

export function step(
  state: BuilderState,
  word: string | null,
  confidence: number,
  now: number,
  config: BuilderConfig = DEFAULT_CONFIG,
): BuilderState {
  const current = word && confidence >= config.minConfidence ? word : null;
  let { words, candidate, candidateSince, locked, lockedLastSeen } = state;

  if (locked) {
    if (current === locked) lockedLastSeen = now;
    else if (now - lockedLastSeen >= config.releaseMs) locked = null;
  }

  if (current !== candidate) {
    candidate = current;
    candidateSince = now;
  }

  if (candidate && candidate !== locked && now - candidateSince >= config.holdMs) {
    words = [...words, candidate];
    locked = candidate;
    lockedLastSeen = now;
  }

  return { words, candidate, candidateSince, locked, lockedLastSeen };
}

/** Split a spoken or typed phrase into words for the shared conversation. */
export function wordsFromSpeech(text: string): string[] {
  return text
    .toUpperCase()
    .split(/[^A-Z0-9']+/)
    .map((word) => word.replace(/^'+|'+$/g, ""))
    .filter((word) => word.length > 0);
}

/** 0..1 progress toward committing the current candidate (for the UI). */
export function holdProgress(state: BuilderState, now: number, config: BuilderConfig = DEFAULT_CONFIG): number {
  if (!state.candidate || state.candidate === state.locked) return 0;
  return Math.min(1, (now - state.candidateSince) / config.holdMs);
}
