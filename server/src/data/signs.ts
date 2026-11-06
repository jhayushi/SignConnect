import type { Sign } from "../repositories/types.js";

// `gesture` is the label the recognizer emits; `word` is added to the conversation.
// The first group is MediaPipe's canned gestures. The rest are landmark signs
// read from the same hand landmarks in the client.
export const SEED_SIGNS: Sign[] = [
  { id: "hello", gesture: "Open_Palm", word: "HELLO", description: "Open palm facing the camera", source: "mediapipe" },
  { id: "yes", gesture: "Thumb_Up", word: "YES", description: "Thumbs up", source: "mediapipe" },
  { id: "no", gesture: "Thumb_Down", word: "NO", description: "Thumbs down", source: "mediapipe" },
  { id: "i-love-you", gesture: "ILoveYou", word: "I LOVE YOU", description: "Thumb, index and pinky extended (ASL)", source: "mediapipe" },
  { id: "peace", gesture: "Victory", word: "PEACE", description: "Index and middle finger in a V", source: "mediapipe" },
  { id: "wait", gesture: "Pointing_Up", word: "WAIT", description: "Index finger pointing up", source: "mediapipe" },
  { id: "stop", gesture: "Closed_Fist", word: "STOP", description: "Closed fist", source: "mediapipe" },

  { id: "please", gesture: "Please", word: "PLEASE", description: "Flat hand circling, then hold", source: "landmarks" },
  { id: "thank-you", gesture: "ThankYou", word: "THANK YOU", description: "Open hand moving toward the camera", source: "landmarks" },
  { id: "sorry", gesture: "Sorry", word: "SORRY", description: "Fist circling, then hold", source: "landmarks" },
  { id: "help", gesture: "Help", word: "HELP", description: "Fist or thumbs-up resting on an open palm", source: "landmarks" },
  { id: "good", gesture: "Good", word: "GOOD", description: "Flat fingertips placed in the other palm", source: "landmarks" },
  { id: "more", gesture: "More", word: "MORE", description: "Fingertips pinched to the thumb", source: "landmarks" },
  { id: "done", gesture: "Done", word: "DONE", description: "Both open hands, palms down, held apart", source: "landmarks" },
  { id: "what", gesture: "What", word: "WHAT", description: "Both open hands, palms up, held apart", source: "landmarks" },
  { id: "name", gesture: "Name", word: "NAME", description: "Both H hands, index and middle together, tips touching", source: "landmarks" },
  { id: "friend", gesture: "Friend", word: "FRIEND", description: "Index fingers hooked or touching", source: "landmarks" },
  { id: "love", gesture: "Love", word: "LOVE", description: "Fists crossed, wrists close together", source: "landmarks" },
];
