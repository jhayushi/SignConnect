# Testing

## Automated

From the repository root:

```bash
npm test
npm run typecheck
npm run build
```

`npm test` runs these checks:

| Check | What it proves |
|---|---|
| `server/src/db/sqlite.test.ts` | Signs are seeded in order. A transcript is still there after the file is closed and opened again. Delete survives that reopen. |
| `server/src/routes/api.test.ts` | Health, the sign list, transcript create/list/view/delete, and landmark sample create, count, CSV, JSON, and delete. Uses a real SQLite database in memory. |
| `client/src/recognition/signal.test.ts` | Wrist-origin scaling is unchanged by shift and scale. The moving average and the one-euro filter follow a step and shrink jitter. |
| `client/src/recognition/fixtures.test.ts` | Every checked-in synthetic fixture still classifies as its label. |
| `client/src/recognition/landmarkSigns.test.ts` | Each landmark sign matches a posed hand. Open palm, thumbs up, closed fist, pointing up, victory, and I-love-you stay unlabeled so the MediaPipe words are not replaced. Motion paths cover PLEASE, THANK YOU, SORRY, EAT, DRINK, WHERE, WATER, J, and Z. |

The client checks build hands from 21 landmarks, so they do not need a webcam. The API check listens on an ephemeral port and calls the routes with `fetch`, including saving a 21-point sample and exporting CSV and JSON.

`npm run evaluate` is separate from `npm test`. It scores the synthetic fixture file and rewrites [RESULTS.md](RESULTS.md). Do not edit that file by hand.

## Manual

1. `npm install` and `npm run dev`.
2. Open http://localhost:5173. **Practice** should list every sign returned by `GET /api/signs`, and search should narrow the list.
3. On **Talk**, click **Start Camera**. Hold an open palm until HELLO is added. A second hand in frame should not replace a clear thumbs-up, fist, or pointing finger.
4. Try a landmark sign from the Practice card (for example L, or a flat O for MORE). Hold it about 0.6 seconds.
5. On Practice, start recording with a label selected, then export CSV or JSON. Recording stays off until that button is pressed.
6. Click **Start Mic** and say a short phrase, or type one. The words should join the same conversation.
7. **Save**. Restart the API process. **History** should still show that conversation. Open it, then delete it. `GET /api/transcripts` should agree.
8. If speech recognition is blocked or missing, the page should say so and the type field should still add words.

Lighting and the exact handshape matter. The Practice description is the pose the rules look for.
