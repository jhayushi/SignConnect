/** Read text aloud with the browser speech synthesizer. Returns false when it is unavailable. */
export function speakText(text: string): boolean {
  const phrase = text.trim();
  if (!phrase || typeof window === "undefined" || !("speechSynthesis" in window)) return false;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(phrase);
  utterance.lang = "en-US";
  utterance.rate = 0.95;
  window.speechSynthesis.speak(utterance);
  return true;
}
