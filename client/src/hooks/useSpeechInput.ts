import { useEffect, useRef, useState } from "react";

interface SpeechAlternative {
  transcript: string;
}

interface SpeechResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: SpeechAlternative;
}

interface SpeechResultEvent {
  resultIndex: number;
  results: { length: number; [index: number]: SpeechResult };
}

interface SpeechErrorEvent {
  error: string;
}

interface BrowserSpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: ((event: SpeechErrorEvent) => void) | null;
  onend: (() => void) | null;
}

type SpeechCtor = new () => BrowserSpeechRecognition;

function getSpeechRecognition(): SpeechCtor | null {
  if (typeof window === "undefined") return null;
  const host = window as Window & {
    SpeechRecognition?: SpeechCtor;
    webkitSpeechRecognition?: SpeechCtor;
  };
  return host.SpeechRecognition ?? host.webkitSpeechRecognition ?? null;
}

/**
 * Browser speech recognition for the person who is not signing.
 * Calls `onPhrase` with each finished phrase. If the browser can't do it,
 * `supported` is false and the caller can show a typed fallback.
 */
export function useSpeechInput(onPhrase: (text: string) => void) {
  const onPhraseRef = useRef(onPhrase);
  onPhraseRef.current = onPhrase;
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const wantRef = useRef(false);
  const mountedRef = useRef(true);

  const [supported] = useState(() => getSpeechRecognition() !== null);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      wantRef.current = false;
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  const ensure = () => {
    if (recognitionRef.current) return recognitionRef.current;
    const Ctor = getSpeechRecognition();
    if (!Ctor) return null;
    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      if (!mountedRef.current) return;
      let pending = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0]?.transcript ?? "";
        if (result.isFinal) onPhraseRef.current(text);
        else pending += text;
      }
      setInterim(pending);
    };
    recognition.onerror = (event) => {
      if (!mountedRef.current || event.error === "aborted" || event.error === "no-speech") return;
      wantRef.current = false;
      setListening(false);
      setInterim("");
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setError("Microphone permission was denied. Type below instead.");
      } else {
        setError("Speech recognition isn't available right now. Type below instead.");
      }
    };
    recognition.onend = () => {
      if (!mountedRef.current) return;
      if (wantRef.current) {
        try {
          recognition.start();
        } catch {
          wantRef.current = false;
          setListening(false);
        }
        return;
      }
      setListening(false);
      setInterim("");
    };
    recognitionRef.current = recognition;
    return recognition;
  };

  const start = () => {
    setError(null);
    const recognition = ensure();
    if (!recognition) {
      setError("Speech recognition isn't available in this browser. Type below instead.");
      return;
    }
    wantRef.current = true;
    try {
      recognition.start();
      setListening(true);
    } catch {
      // start() throws if a session is already running.
      setListening(true);
    }
  };

  const stop = () => {
    wantRef.current = false;
    recognitionRef.current?.stop();
    setListening(false);
    setInterim("");
  };

  return { supported, listening, interim, error, start, stop };
}
