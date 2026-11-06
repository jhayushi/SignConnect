# Design

## Requirements

- One person signs at the camera and another person speaks or types. Both add words to one conversation.
- The sign list and saved conversations persist across a server restart.
- The vocabulary has to be larger than MediaPipe's seven canned gestures, including letters and numbers that a single frame can tell apart.
- A person can look up every supported sign and can reopen or delete a saved conversation.
- Landmark samples can be recorded on purpose, stored, and exported.
- The hold and confidence settings are chosen from a repeatable measurement, not a guess written into the docs.

## Constraints

- Recognition runs in the browser. The server never sees the camera.
- MediaPipe's canned gestures are fixed. Open palm, thumbs up, thumbs down, victory, pointing up, closed fist, and I-love-you already have words. A new rule must not steal those poses.
- No login and no hosted database. SQLite is a file next to the server.
- Two-hand signs need positions in the image. Normalizing each hand onto its own wrist would pile both hands on the origin, so normalization is for stored samples and shape math, not for the two-hand distance checks.
- J, Z, PLEASE, THANK YOU, SORRY, EAT, DRINK, WHERE, and WATER need more than one frame. The static accuracy set does not score those motions.

## Alternatives

| Choice | Other option | Why this one |
|---|---|---|
| SQLite | PostgreSQL | One file, no server to install, still a real database behind the repository interfaces. |
| Hand-landmark rules | A trained classifier | No dataset to start from, and the rules can be unit-tested with a kinematic hand. Recorded samples are there for a later model. |
| One Euro filter on the live stream | No smoothing, or smoothing only in the recorder | The live path should not jump between labels every frame. The recorder uses an exponential moving average because the saved rows should be a simple, documented filter. |
| Synthetic fixtures | Only webcam recordings | Recordings are opt-in and empty in a fresh checkout. The kinematic set is checked in, labeled synthetic, and scored by `npm run evaluate`. |
| Hold 600 ms, confidence 0.7 | The earlier 1000 ms hold, or a 0.9 confidence floor | See the measurement below. |

## Tradeoffs

- Rules are readable and fast (well under a millisecond per hand on the fixture set) but they miss signs that need the face or the body, and they miss letters that share a shape with a canned gesture.
- A shorter hold adds words sooner. It also has less time to reject a flicker. The measurement below is what made 600 ms acceptable: on the twitch replay it committed every fixture and added no extra word.
- Storing landmarks instead of video keeps the table small and avoids saving someone's face. It also means a bad recording cannot be relabeled by watching the clip.
- Exporting CSV with one column per coordinate is awkward to read and easy to load into a spreadsheet. JSON keeps the nested points.

## Iterations

1. MediaPipe's seven gestures only, with a 1000 ms hold and a 0.7 confidence floor.
2. Landmark words, then letters and numbers, still leaving the seven canned poses alone. The clean synthetic file scores 110/110 for the static classifier (mean 0.054 ms, p50 0.021 ms, p95 0.130 ms). Per-sign precision and recall are in [RESULTS.md](RESULTS.md).
3. The hold sweep replays each fixture for 48 frames at 30 fps and replaces every 22nd frame with Gaussian noise (sigma 0.015). At minConfidence 0.7 and holdMs 1000 the builder got 21 correct, 0 false commits, and 89 misses out of 110. The same confidence with holdMs 600 got 110 correct, 0 false commits, and 0 misses. A 0.90 floor at 600 ms fell to 26 correct, because most landmark hits are emitted at 0.86 or 0.88. The sentence builder now uses 0.7 and 600 ms. Release stays 400 ms. The full table is in [RESULTS.md](RESULTS.md).
