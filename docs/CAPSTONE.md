# Requirements map

SignConnect is a small full-stack app for a conversation between someone signing and someone speaking. This page maps the CS/ITI list and the Engineering list onto the code.

## CS / ITI

| Requirement | Where it is |
|---|---|
| Frontend | React + Vite. Talk, Practice, and History in `client/src/App.tsx`. |
| Backend | Express routes in `server/src/routes/` for health, signs, transcripts, and landmark samples. |
| Database | SQLite. Schema and sign seed in `server/src/db/sqlite.ts`. Repositories in `server/src/repositories/`. |
| Computer vision | MediaPipe Gesture Recognizer in `client/src/recognition/mediaPipeRecognizer.ts`. |
| Real time | A frame loop in `CameraView`, smoothed landmarks, and a 600 ms hold in `client/src/sentence/sentenceBuilder.ts`. |
| Speech | Web Speech API in `client/src/hooks/useSpeechInput.ts`, with typing if the mic is unavailable. |
| Landmark algorithms | `client/src/recognition/handshapes.ts` and `landmarkSigns.ts`. |

The Practice screen shows the same sign rows SQLite returns from `GET /api/signs`.

## Engineering

| Requirement | Where it is |
|---|---|
| Meaningful coding | The client, the API, the landmark rules, and the evaluation script. |
| Engineering design | [DESIGN.md](DESIGN.md): requirements, constraints, alternatives, tradeoffs, and the hold/confidence iteration. |
| Data collection and processing | Opt-in recorder on Practice (`client/src/components/SampleRecorder.tsx`). Samples are smoothed, normalized in `client/src/recognition/signal.ts`, stored through `POST /api/samples`, and exported as CSV or JSON. |
| Testing or validation | `npm test` plus `npm run evaluate`, which writes accuracy, precision, recall, a confusion matrix, latency, and the threshold sweep to [RESULTS.md](RESULTS.md). Steps for a person at the keyboard are in [TESTING.md](TESTING.md). |
| Technical diagram | The mermaid diagram in [ARCHITECTURE.md](ARCHITECTURE.md), including the filter, the recorder, and the fixture evaluation. |
| Extra technical component | Computer vision (MediaPipe), not counted as the frontend or the backend. |
| Extra technical component | Landmark geometry and the one-euro / moving-average filters in `signal.ts`. |

Frontend and backend are not counted as the two extra Engineering components. Those two are the vision model and the landmark processing.
