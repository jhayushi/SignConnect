# Testing

## Automated

From the repository root:

```bash
make test
make typecheck
make build
```

`npm test`, `npm run typecheck`, and `npm run build` are the same three commands.

`npm test` runs three checks:

| Check | What it proves |
|---|---|
| `server/src/db/sqlite.test.ts` | Signs are seeded in order. A transcript is still there after the file is closed and opened again. Delete survives that reopen. |
| `server/src/routes/api.test.ts` | `GET /api/health`, `GET /api/signs` (at least 40 signs, including HELLO, A, and WHERE), create, list, view, and delete transcripts, and reject empty or oversized text. Uses a real SQLite database in memory. |
| `client/src/recognition/landmarkSigns.test.ts` | Each landmark sign matches a posed hand. Open palm, thumbs up, closed fist, pointing up, victory, and I-love-you stay unlabeled so the MediaPipe words are not replaced. Motion paths cover PLEASE, THANK YOU, SORRY, EAT, DRINK, WHERE, WATER, J, and Z. |

The client check builds hands from 21 landmarks, so it does not need a webcam. The API check listens on an ephemeral port and calls the routes with `fetch`.

## Manual

1. `npm install` and `npm run dev`.
2. Open http://localhost:5173. **Practice** should list every sign returned by `GET /api/signs`, and search should narrow the list.
3. On **Talk**, click **Start camera**. Hold an open palm until HELLO is added. A second hand in frame should not replace a clear thumbs-up, fist, or pointing finger.
4. Try a landmark sign from the Practice card (for example L, or a flat O for MORE). Hold it about a second.
5. Click **Start Mic** and say a short phrase, or type one. The words should join the same conversation. **Speak** reads that line aloud. A sign that is added is spoken as well, when the browser can synthesize speech.
6. **Save**. Restart the API process. **History** should still show that conversation. Open it, then delete it. `GET /api/transcripts` should agree.
7. If speech recognition is blocked or missing, the page should say so and the type field should still add words.

Lighting and the exact handshape matter. The Practice description is the pose the rules look for.
