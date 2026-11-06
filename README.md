# SignConnect

Recognizes hand signs from your webcam and builds a conversation from them, one word at a time. The other person can speak, or type, into the same conversation.

**v1 scope:** a single screen, in-browser recognition (MediaPipe's Gesture Recognizer plus hand-landmark signs), speech input in the browser, and a SQLite file for signs and saved conversations.

## Run it

```bash
npm install
npm run dev
```

- Client: http://localhost:5173
- API: http://localhost:3001

Open the client and click **Start Camera**. Hold a supported sign for about 1 second to add it. Click **Start Mic** to speak into the same conversation. If the browser has no speech recognition, or the microphone is blocked, type the words instead. **Save** stores the combined text. Saved conversations stay in the database after the server restarts.

## Database

The API uses SQLite. On startup the server creates the file and tables if they are missing, and loads the sign vocabulary. Saved conversations are not wiped on startup.

The default file is `server/data/signconnect.sqlite`. That directory is created automatically and is not committed.

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3001` | API port |
| `DATABASE_PATH` | `server/data/signconnect.sqlite` | SQLite file. An absolute path, a path relative to the `server/` package, or `:memory:` for a temporary database |

```bash
DATABASE_PATH=./signconnect.sqlite npm run dev
```

That example stores the file at `server/signconnect.sqlite`.

Delete the file to reset saved conversations. The next start creates it again and reloads the sign list.

### Camera tips

- Light your hand from the front. A bright window behind you makes the fingers hard to see.
- Keep the hand about a foot from the camera.
- Still signs: hold for about a second. PLEASE, THANK YOU, and SORRY are motions — do the motion, then keep the hand up briefly so the word can be added.
- Two-hand signs need both hands in the frame.
- WHAT and DONE need the palms clearly up or down, not facing the camera.

## Supported signs

### Gestures

These come from MediaPipe's pre-trained Gesture Recognizer.

| Gesture | Word |
|---|---|
| Open palm | HELLO |
| Thumbs up | YES |
| Thumbs down | NO |
| 🤟 I-love-you (ASL) | I LOVE YOU |
| V / victory | PEACE |
| Index pointing up | WAIT |
| Closed fist | STOP |

### Conversational signs

These are read from the hand landmarks on the same camera frames. The shapes are simplified so they can be told apart without a second model. Form them the way the table says, or the camera will miss them.

| Sign | Word | How to show it |
|---|---|---|
| Please | PLEASE | Circle a flat hand, then hold it up |
| Thank you | THANK YOU | Move an open hand toward the camera |
| Sorry | SORRY | Circle a fist, then hold it |
| Help | HELP | Rest a fist or thumbs-up on an open palm |
| Good | GOOD | Place flat fingertips into the other palm |
| More | MORE | Pinch your fingertips to your thumb |
| Done | DONE | Both open hands, palms down, held apart |
| What | WHAT | Both open hands, palms up, held apart |
| Name | NAME | Both H hands (index and middle together), tips touching |
| Friend | FRIEND | Hook or touch the index fingers; other fingers in |
| Love | LOVE | Cross your fists so the wrists are close |

## Structure

```
client/   React + TypeScript (Vite)
  src/recognition/   SignRecognizer, MediaPipe gestures, landmark signs
  src/sentence/      Pure sentence-building rules (confidence, hold-to-add, no repeats)
  src/components/    Camera, speech, detection panel, conversation, lists
server/   Express + TypeScript
  src/db/            SQLite file, schema, and sign seed
  src/repositories/  Repository interfaces + SQLite implementations
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

- **Another database:** implement `SignRepository` / `TranscriptRepository` (in `server/src/repositories/types.ts`) and construct them in `server/src/index.ts`. SQLite is the implementation used today.
- **Another recognizer:** implement `SignRecognizer` (in `client/src/recognition/types.ts`) and return it from `createRecognizer()`.
