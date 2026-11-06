import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeHand, classifyStaticSign } from "./landmarkSigns";
import type { FixtureSample } from "./fixtureSet";
import { DEFAULT_CONFIG, INITIAL_STATE, step, type BuilderConfig } from "../sentence/sentenceBuilder";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = path.join(HERE, "fixtures", "synthetic-hands.json");
const RESULTS_PATH = path.resolve(HERE, "../../../docs/RESULTS.md");

interface FixtureFile {
  source: string;
  description: string;
  samples: FixtureSample[];
}

interface Scored {
  expected: string;
  predicted: string;
  confidence: number;
  seconds: number;
}

const NONE = "(none)";

function loadFixtures(): FixtureFile {
  return JSON.parse(fs.readFileSync(FIXTURE_PATH, "utf8")) as FixtureFile;
}

function classifySample(sample: FixtureSample): { label: string | null; confidence: number } {
  const hands = sample.hands.map((hand) => {
    const analyzed = analyzeHand({
      landmarks: hand.landmarks,
      worldLandmarks: hand.worldLandmarks,
      handedness: hand.handedness,
    });
    if (!analyzed) return null;
    return analyzed;
  }).filter((hand): hand is NonNullable<typeof hand> => hand !== null);
  const found = classifyStaticSign(hands);
  return { label: found?.label ?? null, confidence: found?.confidence ?? 0 };
}

function scoreAll(samples: FixtureSample[]): Scored[] {
  return samples.map((sample) => {
    const start = process.hrtime.bigint();
    const found = classifySample(sample);
    const seconds = Number(process.hrtime.bigint() - start) / 1e9;
    return {
      expected: sample.label ?? NONE,
      predicted: found.label ?? NONE,
      confidence: found.confidence,
      seconds,
    };
  });
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
}

function precisionRecall(rows: Scored[]): { label: string; precision: number; recall: number; support: number }[] {
  const labels = [...new Set(rows.flatMap((row) => [row.expected, row.predicted]))].sort();
  return labels.map((label) => {
    const tp = rows.filter((row) => row.expected === label && row.predicted === label).length;
    const fp = rows.filter((row) => row.expected !== label && row.predicted === label).length;
    const fn = rows.filter((row) => row.expected === label && row.predicted !== label).length;
    const support = rows.filter((row) => row.expected === label).length;
    return {
      label,
      precision: tp + fp === 0 ? 0 : tp / (tp + fp),
      recall: tp + fn === 0 ? 0 : tp / (tp + fn),
      support,
    };
  });
}

function confusion(rows: Scored[]): Map<string, Map<string, number>> {
  const table = new Map<string, Map<string, number>>();
  for (const row of rows) {
    const line = table.get(row.expected) ?? new Map<string, number>();
    line.set(row.predicted, (line.get(row.predicted) ?? 0) + 1);
    table.set(row.expected, line);
  }
  return table;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rng: () => number): number {
  const u = Math.max(rng(), 1e-12);
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const NOISE_SIGMA = 0.015;
const FRAME_MS = 1000 / 30;
const STREAM_FRAMES = 48;
/** One noisy frame after this many clean frames, about 0.73 s at 30 fps. */
const TWITCH_EVERY = 22;

interface TrialResult {
  correct: number;
  falseCommit: number;
  missed: number;
  total: number;
}

function perturb(sample: FixtureSample, rng: () => number): FixtureSample {
  const jitter = (value: number) => value + gaussian(rng) * NOISE_SIGMA;
  return {
    ...sample,
    hands: sample.hands.map((hand) => ({
      ...hand,
      landmarks: hand.landmarks.map((point) => ({ ...point, x: jitter(point.x), y: jitter(point.y), z: jitter(point.z) })),
      worldLandmarks: hand.worldLandmarks.map((point) => ({ ...point, x: jitter(point.x), y: jitter(point.y), z: jitter(point.z) })),
    })),
  };
}

function trial(sample: FixtureSample, config: BuilderConfig, seed: number): "correct" | "false" | "missed" {
  const rng = mulberry32(seed);
  let state = INITIAL_STATE;
  for (let frame = 0; frame < STREAM_FRAMES; frame++) {
    const noisy = frame % TWITCH_EVERY === TWITCH_EVERY - 1;
    const found = classifySample(noisy ? perturb(sample, rng) : sample);
    state = step(state, found.label, found.confidence, frame * FRAME_MS, config);
  }
  const expected = sample.label;
  if (expected === null) return state.words.length === 0 ? "correct" : "false";
  const wrong = state.words.filter((word) => word !== expected).length;
  if (wrong > 0) return "false";
  return state.words.includes(expected) ? "correct" : "missed";
}

function evaluateConfig(samples: FixtureSample[], config: BuilderConfig): TrialResult {
  const result = { correct: 0, falseCommit: 0, missed: 0, total: samples.length };
  samples.forEach((sample, index) => {
    const outcome = trial(sample, config, 1000 + index * 17);
    if (outcome === "correct") result.correct += 1;
    else if (outcome === "false") result.falseCommit += 1;
    else result.missed += 1;
  });
  return result;
}

function pct(part: number, total: number): string {
  if (total === 0) return "0.0%";
  return `${((100 * part) / total).toFixed(1)}%`;
}

function num(value: number): string {
  return value.toFixed(3);
}

function writeResults(file: FixtureFile, clean: Scored[], sweep: { config: BuilderConfig; result: TrialResult }[]): void {
  const correct = clean.filter((row) => row.expected === row.predicted).length;
  const latencies = clean.map((row) => row.seconds * 1000).sort((a, b) => a - b);
  const meanLatency = latencies.reduce((sum, value) => sum + value, 0) / Math.max(latencies.length, 1);
  const byLabel = precisionRecall(clean);
  const matrix = confusion(clean);
  const labels = [...matrix.keys()].sort();

  const baseline: BuilderConfig = { minConfidence: 0.7, holdMs: 1000, releaseMs: 400 };
  const baselineRow = sweep.find(
    (row) =>
      row.config.minConfidence === baseline.minConfidence &&
      row.config.holdMs === baseline.holdMs &&
      row.config.releaseMs === baseline.releaseMs,
  );
  const ranked = [...sweep].sort((a, b) => {
    if (b.result.correct !== a.result.correct) return b.result.correct - a.result.correct;
    if (a.result.falseCommit !== b.result.falseCommit) return a.result.falseCommit - b.result.falseCommit;
    if (a.config.holdMs !== b.config.holdMs) return a.config.holdMs - b.config.holdMs;
    return Math.abs(a.config.minConfidence - 0.7) - Math.abs(b.config.minConfidence - 0.7);
  });
  const chosen = ranked[0];

  const lines: string[] = [];
  lines.push("# Classifier results");
  lines.push("");
  lines.push("Generated by `npm run evaluate`. The figures below are the script output for the checked-in synthetic fixture file. They are not webcam measurements.");
  lines.push("");
  lines.push(`Fixture: \`client/src/recognition/fixtures/synthetic-hands.json\``);
  lines.push("");
  lines.push(file.description);
  lines.push("");
  lines.push("## Clean fixture set");
  lines.push("");
  lines.push(`- Samples: ${clean.length}`);
  lines.push(`- Accuracy: ${correct}/${clean.length} (${pct(correct, clean.length)})`);
  lines.push(`- Classify latency: mean ${meanLatency.toFixed(3)} ms, p50 ${percentile(latencies, 50).toFixed(3)} ms, p95 ${percentile(latencies, 95).toFixed(3)} ms`);
  lines.push("");
  lines.push("Latency is the wall time of one `analyzeHand` plus `classifyStaticSign` call in this process.");
  lines.push("");
  lines.push("### Precision and recall");
  lines.push("");
  lines.push("| Label | Support | Precision | Recall |");
  lines.push("|---|---:|---:|---:|");
  for (const row of byLabel) {
    if (row.support === 0 && row.precision === 0) continue;
    lines.push(`| ${row.label} | ${row.support} | ${num(row.precision)} | ${num(row.recall)} |`);
  }
  lines.push("");
  lines.push("### Confusion matrix");
  lines.push("");
  lines.push("Rows are the fixture label. Columns are the label the static classifier returned. `(none)` means no landmark sign.");
  lines.push("");
  lines.push(`| True \\\\ Predicted | ${labels.map((label) => label).join(" | ")} |`);
  lines.push(`|---|${labels.map(() => "---:").join("|")}|`);
  for (const expected of labels) {
    const line = matrix.get(expected) ?? new Map();
    const cells = labels.map((predicted) => String(line.get(predicted) ?? 0));
    lines.push(`| ${expected} | ${cells.join(" | ")} |`);
  }
  lines.push("");
  lines.push("## Noisy streams and thresholds");
  lines.push("");
  lines.push(`Each fixture is replayed for ${STREAM_FRAMES} frames at 30 fps. Frames stay on the recorded pose except every ${TWITCH_EVERY}nd frame, which adds Gaussian noise with sigma ${NOISE_SIGMA} (seeded, so the run is repeatable). That is a brief loss of the pose about every 0.73 s. The sentence builder then tries to commit one word. A trial is correct when the committed words are exactly the fixture label, or empty when the fixture is a pose reserved for a MediaPipe gesture.`);
  lines.push("");
  lines.push("The previous defaults were minConfidence 0.7, holdMs 1000, releaseMs 400. The sweep keeps releaseMs at 400. It picks the row with the most correct trials, then the fewest false commits, then the shorter hold.");
  lines.push("");
  lines.push("| minConfidence | holdMs | Correct | False commits | Missed |");
  lines.push("|---:|---:|---:|---:|---:|");
  for (const row of sweep) {
    lines.push(
      `| ${row.config.minConfidence.toFixed(2)} | ${row.config.holdMs} | ${row.result.correct} | ${row.result.falseCommit} | ${row.result.missed} |`,
    );
  }
  lines.push("");
  const before = baselineRow?.result;
  lines.push("### Before and after");
  lines.push("");
  if (before && chosen) {
    lines.push(`- Before: minConfidence ${baseline.minConfidence}, holdMs ${baseline.holdMs} → correct ${before.correct}, false commits ${before.falseCommit}, missed ${before.missed} (of ${before.total}).`);
    lines.push(`- After: minConfidence ${chosen.config.minConfidence}, holdMs ${chosen.config.holdMs} → correct ${chosen.result.correct}, false commits ${chosen.result.falseCommit}, missed ${chosen.result.missed} (of ${chosen.result.total}).`);
    lines.push(`- Code defaults now: minConfidence ${DEFAULT_CONFIG.minConfidence}, holdMs ${DEFAULT_CONFIG.holdMs}, releaseMs ${DEFAULT_CONFIG.releaseMs}.`);
  }
  lines.push("");
  fs.writeFileSync(RESULTS_PATH, `${lines.join("\n")}\n`);
  console.log(`accuracy ${correct}/${clean.length}`);
  console.log(`latency mean ${meanLatency.toFixed(3)} ms`);
  if (before && chosen) {
    console.log(
      `before ${baseline.minConfidence}/${baseline.holdMs} correct ${before.correct} false ${before.falseCommit} missed ${before.missed}`,
    );
    console.log(
      `chosen ${chosen.config.minConfidence}/${chosen.config.holdMs} correct ${chosen.result.correct} false ${chosen.result.falseCommit} missed ${chosen.result.missed}`,
    );
  }
  console.log(`wrote ${RESULTS_PATH}`);
}

const file = loadFixtures();
const clean = scoreAll(file.samples);
const configs: BuilderConfig[] = [];
for (const minConfidence of [0.6, 0.7, 0.8, 0.85, 0.9]) {
  for (const holdMs of [600, 800, 1000, 1200]) {
    configs.push({ minConfidence, holdMs, releaseMs: 400 });
  }
}
const sweep = configs.map((config) => ({ config, result: evaluateConfig(file.samples, config) }));
writeResults(file, clean, sweep);
