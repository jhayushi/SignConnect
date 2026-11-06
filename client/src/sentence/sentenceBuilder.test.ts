import assert from "node:assert/strict";
import { INITIAL_STATE, step, type BuilderState } from "./sentenceBuilder";
import { framingTip } from "../recognition/framing";
import type { Point } from "../recognition/types";

function run(frames: [string | null, number][], start = 0, frameMs = 33): BuilderState {
  let state = INITIAL_STATE;
  frames.forEach(([word, confidence], i) => {
    state = step(state, word, confidence, start + i * frameMs);
  });
  return state;
}

const held = (word: string | null, n: number, c = 0.9): [string | null, number][] =>
  Array.from({ length: n }, () => [word, c]);

// Holding a sign for ~1s adds it once.
assert.deepEqual(run(held("HELLO", 40)).words, ["HELLO"]);

// A short sign is not added.
assert.deepEqual(run(held("HELLO", 10)).words, []);

// One or two dropped frames in the middle don't restart the hold.
assert.deepEqual(run([...held("HELLO", 15), ...held(null, 2), ...held("HELLO", 15)]).words, ["HELLO"]);

// A real pause (longer than the grace period) does restart it.
assert.deepEqual(run([...held("HELLO", 15), ...held(null, 15), ...held("HELLO", 15)]).words, []);

// Holding the same sign longer does not repeat it; lowering the hand and signing again does.
assert.deepEqual(run([...held("YES", 80), ...held(null, 20), ...held("YES", 40)]).words, ["YES", "YES"]);

// Low-confidence frames are ignored.
assert.deepEqual(run(held("NO", 40, 0.4)).words, []);

console.log("sentence builder ok");

const hand = (cx: number, cy: number, size: number): Point[] =>
  Array.from({ length: 21 }, (_, i) => ({
    x: cx - size / 2 + (size * (i % 5)) / 4,
    y: cy - size / 2 + (size * Math.floor(i / 5)) / 4,
    z: 0,
    visibility: 1,
  }));

assert.equal(framingTip([]), "no-hand");
assert.equal(framingTip([hand(0.5, 0.5, 0.08)]), "too-far");
assert.equal(framingTip([hand(0.5, 0.5, 0.9)]), "too-close");
assert.equal(framingTip([hand(0.05, 0.5, 0.3)]), "off-center");
assert.equal(framingTip([hand(0.5, 0.5, 0.3)]), "good");

console.log("framing tips ok");
