import data from "./fixtures/synthetic-hands.json";
import { predictedLabel, type FixtureSample } from "./fixtureSet";

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const samples = data.samples as FixtureSample[];

check(data.source === "synthetic", "fixture file should be marked synthetic");
check(samples.length >= 40, `expected a useful fixture set, got ${samples.length}`);

let misses = 0;
for (const sample of samples) {
  check(sample.source === "synthetic", "sample source");
  check(sample.hands[0]?.landmarks.length === 21, "each hand needs 21 landmarks");
  if (predictedLabel(sample) !== sample.label) misses += 1;
}
check(misses === 0, `${misses} synthetic fixtures did not match their labels`);
console.log(`synthetic fixtures ok (${samples.length})`);
