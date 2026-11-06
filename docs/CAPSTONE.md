# Requirements map

SignConnect is one screen for a conversation between someone signing and someone speaking. Frontend, backend, and the database are the base. They are not extras. CRUD, accounts, and deployment are not extras either.

## Base

| Requirement | Where it is |
|---|---|
| Frontend | React + Vite. Talk, Practice, and History in `client/src/App.tsx`, with the camera, speech panel, conversation bar, practice list, and history view under `client/src/components/`. |
| Backend | Express in `server/src/app.ts` and `server/src/routes/`. Routes call repository interfaces, not SQL. |
| Database | SQLite opened in `server/src/db/sqlite.ts`. `SqliteSignRepository` and `SqliteTranscriptRepository` in `server/src/repositories/sqlite.ts` persist the sign list and saved conversations. |

## Extras

Each extra is wired into the same conversation, not a separate demo.

### 1. Computer vision with MediaPipe hand tracking

`client/src/recognition/mediaPipeRecognizer.ts` loads MediaPipe's Gesture Recognizer and runs it on each video frame in `recognizeForVideo`. It returns up to two hands: 21 landmarks each, which hand is left or right, and one of the seven canned gestures (open palm, thumbs up, thumbs down, I-love-you, victory, pointing up, closed fist). `client/src/components/CameraView.tsx` draws those landmarks on the camera. `client/src/recognition/compositeRecognizer.ts` is what the camera calls, so the MediaPipe result is the input to the rest of recognition rather than a side path.

### 2. Custom landmark classification algorithm

MediaPipe's seven gestures are not the whole vocabulary. `client/src/recognition/handshapes.ts` scores finger extension, whether the thumb is out or touching a fingertip, palm facing, and which way the index points. `client/src/recognition/landmarkSigns.ts` adds the two-hand signs (HELP, GOOD, FRIEND, NAME, FAMILY, LOVE, WHAT, DONE) and the short motions (PLEASE, THANK YOU, SORRY, EAT, DRINK, WHERE, WATER, J, Z). `classifyStaticSign` runs before the canned label is kept, but the poses that match those seven gestures are left unlabeled so HELLO, YES, NO, I LOVE YOU, PEACE, WAIT, and STOP are not replaced. The label is then looked up in the sign list from the API and appended to the conversation.

### 3. Real-time functionality from the live webcam loop

`CameraView` does not take a snapshot. `requestAnimationFrame` calls the recognizer on every new video frame while the camera is running. A label is not added on the first frame. `client/src/sentence/sentenceBuilder.ts` waits until the same word stays at or above 0.65 confidence for about a second (`holdMs` 900). A one- or two-frame flicker does not restart that timer (`graceMs` 250), and the word is not added again until the hand leaves. The detection panel shows the live word, how sure the recognizer is, the hold progress, and a framing tip (move closer, keep your hand in the frame) from that same loop.

### 4. Natural language: speech-to-text and text-to-speech

Speech-to-text is `client/src/hooks/useSpeechInput.ts` and `client/src/components/SpeechPanel.tsx`. The Web Speech API turns the microphone into text. Final phrases go through `addText` in `client/src/hooks/useSentenceBuilder.ts` and land in the same word list as the signs. If recognition is missing or the mic is denied, the typed field uses that same `addText` path.

Text-to-speech is `client/src/speech/speak.ts`. When the camera loop commits a sign, `App.tsx` speaks that word. **Speak** on the conversation bar, and **Speak** on a saved conversation in `client/src/components/HistoryView.tsx`, read the full text with `speechSynthesis`. Signing, speaking, typing, and playback are one transcript, which **Save** writes through `POST /api/transcripts`.

## Docs

| Doc | What it is |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | How the pieces connect, including the mermaid diagram |
| [TESTING.md](TESTING.md) | Automated checks and the manual demo steps |
| [TECHNICAL_QA.md](TECHNICAL_QA.md) | Short answers for how each extra works |
