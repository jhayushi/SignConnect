# Capstone map

SignConnect is a small full-stack app for a conversation between someone signing and someone speaking.

| Area | Where it shows up |
|---|---|
| Frontend | React + Vite client: Talk, Practice, and History. Camera, detection meters, and the shared conversation. |
| Backend | Express API: health, signs, and transcripts. Routes depend on repository interfaces, not on SQL. |
| Database | SQLite via better-sqlite3. Schema and sign seed run on startup. Conversations survive a restart. `DATABASE_PATH` chooses the file. |
| Computer vision | MediaPipe Gesture Recognizer in the browser supplies landmarks and seven canned gestures. |
| Real time | Each video frame is classified in the browser. A word is added only after it holds steady for about a second. |
| Speech | The Web Speech API appends the other person's phrase to the same conversation. Typing is the fallback. |
| Landmark algorithms | `client/src/recognition/handshapes.ts` and `landmarkSigns.ts` score finger extension, thumb placement, palm facing, and short motions (circle, approach, wag, Z, J). |

The sign list the Practice screen shows is the same list stored in SQLite and returned by `GET /api/signs`.
