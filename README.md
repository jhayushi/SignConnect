# SignConnect

Recognizes a small set of hand signs from your webcam and builds a sentence from them, one word at a time.

**v1 scope:** a single screen, in-browser recognition with MediaPipe's pre-trained Gesture Recognizer, and in-memory storage (no database yet).

## Run it

```bash
npm install
npm run dev
```

- Client: http://localhost:5173
- API: http://localhost:3001

Open the client, click **Start Camera**, and hold a supported sign for about 1 second to add it to the sentence.

## Supported signs (v1)

| Gesture | Word |
|---|---|
| Open palm | HELLO |
| Thumbs up | YES |
| Thumbs down | NO |
| 🤟 I-love-you (ASL) | I LOVE YOU |
| V / victory | PEACE |
| Index pointing up | WAIT |
| Closed fist | STOP |

## Structure

```
client/   React + TypeScript (Vite)
  src/recognition/   SignRecognizer interface + MediaPipe implementation
  src/sentence/      Pure sentence-building rules (confidence, hold-to-add, no repeats)
  src/components/    Camera, detection panel, sentence bar, lists
server/   Express + TypeScript
  src/repositories/  Repository interfaces + in-memory implementations
  src/routes/        /api/signs, /api/transcripts
```

## API

| Method | Path | Description |
|---|---|---|
| GET | `/api/signs` | Supported signs (gesture → word) |
| GET | `/api/transcripts` | Saved sentences, newest first |
| POST | `/api/transcripts` | Save a sentence: `{ "text": "HELLO YES" }` |
| DELETE | `/api/transcripts/:id` | Delete a saved sentence |

## Extending

- **Database:** implement `SignRepository` / `TranscriptRepository` (in `server/src/repositories/types.ts`) with PostgreSQL and swap them in `server/src/index.ts`.
- **Vision API recognizer:** implement `SignRecognizer` (in `client/src/recognition/types.ts`) and return it from `createRecognizer()`.
