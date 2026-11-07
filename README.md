# SignConnect

Recognizes hand signs from your webcam and builds a conversation from them, one word at a time. The other person can speak, or type, into the same conversation.

**v1 scope:** a single screen, in-browser recognition (MediaPipe's Gesture Recognizer plus hand-landmark signs), speech input in the browser, and a SQLite file for signs and saved conversations.

## Run it

```bash
make install
make dev
```

`make help` lists every target.

| Target | What it does |
|---|---|
| `install` | `npm install` |
| `dev` | Vite client on port 5173 and the API on port 3001 |
| `build` | Build the client and the API |
| `test` | Automated checks |
| `typecheck` | Typecheck both packages |
| `start` | Build, then serve the site and `/api` from one process |
| `clean` | Remove `client/dist`, `server/dist`, and the local database |

`make dev` is the day-to-day loop:

- Client: http://localhost:5173
- API: http://localhost:3001

The client calls relative `/api` URLs. In development, Vite proxies those to the API. `make start` does not use Vite: Express serves `client/dist` and `/api` on `PORT` (default 3001), so http://localhost:3001 is the whole app.

Open the client and click **Start Camera**. Hold a supported sign for about 1 second to add it. Click **Start Mic** to speak into the same conversation. If the browser has no speech recognition, or the microphone is blocked, type the words instead. **Speak** reads the conversation aloud. A recognized sign is also spoken as it is added. **Save** stores the combined text. Saved conversations stay in the database after the server restarts.

The screen has three sections: **Talk** (camera, microphone, and the live conversation), **Practice** (every sign from the API), and **History** (open or delete a saved conversation).

## Database

The API uses SQLite. On startup the server creates the file and tables if they are missing, and loads the sign vocabulary. Saved conversations are not wiped on startup.

The default file is `server/data/signconnect.sqlite`. That directory is created automatically and is not committed.

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3001` | Port for the API. `make start` serves the site on this port too |
| `HOST` | `0.0.0.0` | Address the server binds |
| `DATABASE_PATH` | `server/data/signconnect.sqlite` | SQLite file. An absolute path, a path relative to the `server/` package, or `:memory:` for a temporary database |

```bash
DATABASE_PATH=./signconnect.sqlite npm run dev
```

That example stores the file at `server/signconnect.sqlite`.

Delete the file to reset saved conversations. The next start creates it again and reloads the sign list.

## Running it

SignConnect runs locally. The camera needs a secure page, and `http://localhost` is treated as secure, so no HTTPS setup is needed on your own machine.

- `make dev` for development: http://localhost:5173
- `make start` to build and serve the whole app from one process: http://localhost:3001

## Camera tips

- Light your hand from the front. A bright window behind you makes the fingers hard to see.
- Keep the hand about a foot from the camera.
- Still signs: hold for about a second. PLEASE, THANK YOU, and SORRY are motions — do the motion, then keep the hand up briefly so the word can be added.
- Two-hand signs need both hands in the frame.
- WHAT and DONE need the palms clearly up or down, not facing the camera.

## Supported signs

52 signs. The Practice screen is the full list from `GET /api/signs`.

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
| Eat | EAT | Flat O moving up, then hold |
| Drink | DRINK | C hand moving up, then hold |
| Where | WHERE | Index finger wagging side to side |
| Water | WATER | W hand bobbing, then hold |
| Family | FAMILY | Both hands in F |
| Bad | BAD | Open hand, palm down |

### Letters and numbers

Fingerspelling and numbers that can be told apart from a single frame (or a short motion for J and Z). The Practice screen lists the handshape for each one.

Letters: A, B, C, D, E, F, G, H, I, J, K, L, M, N, P, Q, R, T, U, W, X, Y, Z.

Numbers: 3, 4, 6, 7, 8.

These shapes are already used by another sign, so they are not separate entries:

| Shape | Already used as |
|---|---|
| Closed fist | STOP |
| Thumb across the fist (S) | STOP |
| Open palm | HELLO |
| Thumbs up | YES |
| Index pointing up | WAIT |
| V / victory | PEACE |
| Thumb and index circle with three fingers up | F (also the ASL number 9) |
| Flat O | MORE (the letter O is the same family) |

## Architecture

The browser reads the webcam with MediaPipe, classifies extra signs from hand landmarks, and takes speech from the Web Speech API. Talk, Practice, and History all call the Express API. Signs and saved conversations live in SQLite. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Testing

`npm test` runs the landmark checks, the SQLite round-trip, and the API route checks. `npm run typecheck` and `npm run build` should pass as well. Manual steps are in [docs/TESTING.md](docs/TESTING.md). How this maps to a frontend, backend, database, and the four extras is in [docs/CAPSTONE.md](docs/CAPSTONE.md). Short answers for each extra are in [docs/TECHNICAL_QA.md](docs/TECHNICAL_QA.md).

## Structure

```
client/   React + TypeScript (Vite)
  src/recognition/   SignRecognizer, MediaPipe gestures, landmark signs
  src/sentence/      Pure sentence-building rules (confidence, hold-to-add, no repeats)
  src/components/    Camera, speech, practice, history, conversation
server/   Express + TypeScript
  src/db/            SQLite file, schema, and sign seed
  src/repositories/  Repository interfaces + SQLite implementations
  src/routes/        /api/signs, /api/transcripts
```

## API

| Method | Path | Description |
|---|---|---|
| GET | `/api/signs` | Supported signs (gesture → word) |
| GET | `/api/transcripts` | Saved conversations, newest first |
| GET | `/api/transcripts/:id` | One saved conversation |
| POST | `/api/transcripts` | Save a conversation: `{ "text": "HELLO YES" }` |
| DELETE | `/api/transcripts/:id` | Delete a saved conversation |

## Extending

- **Another database:** implement `SignRepository` / `TranscriptRepository` (in `server/src/repositories/types.ts`) and construct them in `server/src/index.ts`. SQLite is the implementation used today.
- **Another recognizer:** implement `SignRecognizer` (in `client/src/recognition/types.ts`) and return it from `createRecognizer()`.
