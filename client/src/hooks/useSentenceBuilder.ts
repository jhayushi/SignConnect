import { useCallback, useRef, useState } from "react";
import { INITIAL_STATE, holdProgress, step, wordsFromSpeech, type BuilderState } from "../sentence/sentenceBuilder";

export function useSentenceBuilder() {
  const stateRef = useRef<BuilderState>(INITIAL_STATE);
  const [words, setWords] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);

  const push = useCallback((word: string | null, confidence: number) => {
    const now = performance.now();
    const next = step(stateRef.current, word, confidence, now);
    if (next.words !== stateRef.current.words) setWords(next.words);
    stateRef.current = next;
    setProgress(holdProgress(next, now));
  }, []);

  const undo = useCallback(() => {
    const nextWords = stateRef.current.words.slice(0, -1);
    stateRef.current = { ...stateRef.current, words: nextWords };
    setWords(nextWords);
  }, []);

  const clear = useCallback(() => {
    stateRef.current = { ...stateRef.current, words: [] };
    setWords([]);
  }, []);

  // Speech and typing skip the hold timer: the speaker already finished the phrase.
  const addText = useCallback((text: string) => {
    const incoming = wordsFromSpeech(text);
    if (incoming.length === 0) return false;
    const nextWords = [...stateRef.current.words, ...incoming];
    stateRef.current = { ...stateRef.current, words: nextWords };
    setWords(nextWords);
    return true;
  }, []);

  return { words, progress, push, undo, clear, addText };
}
