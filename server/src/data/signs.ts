import type { Sign } from "../repositories/types.js";

// The 7 gestures MediaPipe's pre-trained Gesture Recognizer supports, mapped to words.
// Only "ILoveYou" is a true ASL sign; the rest are stand-ins until a better recognizer is added.
export const SEED_SIGNS: Sign[] = [
  { id: "hello", gesture: "Open_Palm", word: "HELLO", description: "Open palm facing the camera" },
  { id: "yes", gesture: "Thumb_Up", word: "YES", description: "Thumbs up" },
  { id: "no", gesture: "Thumb_Down", word: "NO", description: "Thumbs down" },
  { id: "i-love-you", gesture: "ILoveYou", word: "I LOVE YOU", description: "Thumb, index and pinky extended (ASL)" },
  { id: "peace", gesture: "Victory", word: "PEACE", description: "Index and middle finger in a V" },
  { id: "wait", gesture: "Pointing_Up", word: "WAIT", description: "Index finger pointing up" },
  { id: "stop", gesture: "Closed_Fist", word: "STOP", description: "Closed fist" },
];
