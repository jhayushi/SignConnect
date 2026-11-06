// Pure logic that turns a stream of per-frame predictions into a sentence.
// Rules:
//   1. Ignore predictions below `minConfidence`.
//   2. A word is committed only after it is held steadily for `holdMs`.
//   3. The same word can't be committed again until the hand leaves or changes
//      sign for at least `releaseMs` (so brief flickers don't cause duplicates).
//   4. A one- or two-frame dropout while holding a sign does not restart the
//      hold timer; the candidate only changes after `graceMs` of disagreement.

export interface BuilderConfig {
  minConfidence: number;
  holdMs: number;
  releaseMs: number;
  graceMs: number;
}

export const DEFAULT_CONFIG: BuilderConfig = {
  minConfidence: 0.65,
  holdMs: 900,
  releaseMs: 400,
  graceMs: 250,
};

export interface BuilderState {
  words: string[];
  candidate: string | null;
  candidateSince: number;
  locked: string | null;
  lockedLastSeen: number;
  /** When the input first disagreed with the candidate, or null while it agrees. */
  missSince: number | null;
}

export const INITIAL_STATE: BuilderState = {
  words: [],
  candidate: null,
  candidateSince: 0,
  locked: null,
  lockedLastSeen: 0,
  missSince: null,
};

export function step(
  state: BuilderState,
  word: string | null,
  confidence: number,
  now: number,
  config: BuilderConfig = DEFAULT_CONFIG,
): BuilderState {
  const current = word && confidence >= config.minConfidence ? word : null;
  let { words, candidate, candidateSince, locked, lockedLastSeen, missSince } = state;

  if (locked) {
    if (current === locked) lockedLastSeen = now;
    else if (now - lockedLastSeen >= config.releaseMs) locked = null;
  }

  if (current === candidate) {
    missSince = null;
  } else if (candidate === null) {
    candidate = current;
    candidateSince = now;
    missSince = null;
  } else {
    // Tolerate a brief flicker before giving up on the sign being held.
    if (missSince === null) missSince = now;
    if (now - missSince >= config.graceMs) {
      candidate = current;
      candidateSince = now;
      missSince = null;
    }
  }

  if (candidate && candidate !== locked && now - candidateSince >= config.holdMs) {
    words = [...words, candidate];
    locked = candidate;
    lockedLastSeen = now;
  }

  return { words, candidate, candidateSince, locked, lockedLastSeen, missSince };
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
