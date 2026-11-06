# Technical questions

Short answers for how the pieces fit together. File names are the places to read.

## How does the camera become a hand?

`CameraView` starts the webcam and, on each new video frame, calls `createRecognizer()`. That returns `CompositeRecognizer`, which calls `MediaPipeRecognizer.recognize`. MediaPipe's Gesture Recognizer (`recognizeForVideo`) gives back landmarks for up to two hands, a left/right label, and at most one canned gesture. The canvas in `CameraView` draws the landmarks. The word on screen is not the raw category name. `App.tsx` looks the label up in the sign list from `GET /api/signs`.

## What is MediaPipe responsible for, and what is our code responsible for?

MediaPipe, in `client/src/recognition/mediaPipeRecognizer.ts`, tracks the hand and classifies seven gestures: open palm, thumbs up, thumbs down, I-love-you, victory, pointing up, and closed fist. Those become HELLO, YES, NO, I LOVE YOU, PEACE, WAIT, and STOP.

Everything else is `handshapes.ts` and `landmarkSigns.ts`. They use the 21 landmarks MediaPipe already computed. They do not load a second vision model.

## How does the landmark classifier decide a sign?

For one hand, `classifyOneHand` looks at which fingers are extended, curled, or partly bent, where the thumb sits (out, across the palm, beside the index, or on a fingertip), which way the index points, and which way the palm faces. Two-hand signs are checked first in `classifyStaticSign`: for example HELP is a fist on an open palm, and WHAT is two palms up and apart. Motions such as PLEASE, EAT, and Z use a short history of wrist or fingertip positions in `GestureTracker`. A custom label is only kept when that geometry matches. The seven canned poses are returned as no landmark sign, so the MediaPipe word is the one that is used.

## Why are some letters and numbers missing?

S is a fist, which is already STOP. V is already PEACE. An open hand is HELLO, a thumbs-up is YES, and a pointing index is WAIT. The letter O is the same family as the flat-O used for MORE, and the number 9 is the same shape as F. `classifyOneHand` returns nothing for those poses on purpose. The list of what was kept is in the README.

## What makes this real time, rather than a picture upload?

The loop is `requestAnimationFrame` in `CameraView`. Each new frame from the live `<video>` element is classified immediately. The sentence builder in `sentenceBuilder.ts` is what keeps that stream from adding a word on every frame: the same label has to stay at or above 0.7 confidence for about a second (`holdMs` is 1000). The hold meter in `DetectionPanel` is that timer. After a word is added it is locked until the hand changes, so one held sign does not repeat.

## How do speech-to-text and text-to-speech share the conversation with the signs?

`useSpeechInput` runs the browser's speech recognizer. A finished phrase is split into words by `wordsFromSpeech` and appended with `addText`. That is the same `words` array the camera writes to, so a spoken "hello" and a signed HELLO show up in one line. Typing uses `addText` too when the mic cannot.

The other direction is `speakText` in `client/src/speech/speak.ts`. `App.tsx` calls it with the word just committed by the camera, so a hearing person hears the sign. The **Speak** button on the conversation bar, and the one on a saved conversation, pass the whole transcript to `speechSynthesis`. Saving still posts that combined text to `/api/transcripts`.

## What is stored, and what stays in the browser?

The camera, MediaPipe, the landmark rules, speech recognition, and speech synthesis all run in the browser. SQLite, opened in `server/src/db/sqlite.ts`, stores the sign vocabulary (seeded on startup) and the saved conversations. Practice and History read those rows back through the API. Nothing about the live video is written to the database.

## How can this be tested without waving at a camera?

`client/src/recognition/landmarkSigns.test.ts` builds 21-point hands and checks each landmark sign, including that the seven canned poses are not relabeled. `server/src/routes/api.test.ts` calls the HTTP routes, including a sign count of 52. `server/src/db/sqlite.test.ts` closes the database file and opens it again to show a transcript is still there. `npm test`, `npm run typecheck`, and `npm run build` are the automated set. A person can still walk through Practice, Talk, and History as written in `TESTING.md`.
