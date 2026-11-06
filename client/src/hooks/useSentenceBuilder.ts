import { useCallback, useRef, useState } from "react";
import { INITIAL_STATE, holdProgress, step, wordsFromSpeech, type BuilderState } from "../sentence/sentenceBuilder";

/**
 * Holds the conversation's word list.
 * With `confirmSigns` on, a finished hold becomes a pending suggestion that
 * the signer accepts with `confirm()` or drops with `dismiss()`, so a misread
 * sign never lands in the conversation on its own.
 */
export function useSentenceBuilder(confirmSigns: boolean) {
  const stateRef = useRef<BuilderState>(INITIAL_STATE);
  const confirmRef = useRef(confirmSigns);
  confirmRef.current = confirmSigns;
  const pendingRef = useRef<string | null>(null);
  const [words, setWords] = useState<string[]>([]);
  const [pending, setPendingState] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const setPending = useCallback((word: string | null) => {
    pendingRef.current = word;
    setPendingState(word);
  }, []);

  /** Feed one frame. Returns the word if it went straight into the conversation. */
  const push = useCallback(
    (word: string | null, confidence: number): string | null => {
      const now = performance.now();
      let next = step(stateRef.current, word, confidence, now);
      const committed = next.words.length > stateRef.current.words.length ? next.words[next.words.length - 1] : null;
      let added: string | null = committed;
      if (committed && confirmRef.current) {
        // Keep the list as it was; the newest suggestion replaces any older one.
        next = { ...next, words: stateRef.current.words };
        setPending(committed);
        added = null;
      }
      if (next.words !== stateRef.current.words) setWords(next.words);
      stateRef.current = next;
      setProgress(holdProgress(next, now));
      return added;
    },
    [setPending],
  );

  /** Add the pending suggestion. Returns it, or null when nothing was pending. */
  const confirm = useCallback((): string | null => {
    const word = pendingRef.current;
    if (!word) return null;
    const nextWords = [...stateRef.current.words, word];
    stateRef.current = { ...stateRef.current, words: nextWords };
    setWords(nextWords);
    setPending(null);
    return word;
  }, [setPending]);

  const dismiss = useCallback(() => setPending(null), [setPending]);

  const undo = useCallback(() => {
    const nextWords = stateRef.current.words.slice(0, -1);
    stateRef.current = { ...stateRef.current, words: nextWords };
    setWords(nextWords);
  }, []);

  const clear = useCallback(() => {
    stateRef.current = { ...stateRef.current, words: [] };
    setWords([]);
    setPending(null);
  }, [setPending]);

  // Speech and typing skip the hold timer: the speaker already finished the phrase.
  const addText = useCallback((text: string) => {
    const incoming = wordsFromSpeech(text);
    if (incoming.length === 0) return false;
    const nextWords = [...stateRef.current.words, ...incoming];
    stateRef.current = { ...stateRef.current, words: nextWords };
    setWords(nextWords);
    return true;
  }, []);

  return { words, pending, progress, push, confirm, dismiss, undo, clear, addText };
}
