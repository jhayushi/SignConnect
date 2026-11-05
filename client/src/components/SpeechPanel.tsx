import { useState, type FormEvent } from "react";
import { useSpeechInput } from "../hooks/useSpeechInput";

interface Props {
  onPhrase: (text: string) => boolean;
}

export function SpeechPanel({ onPhrase }: Props) {
  const speech = useSpeechInput(onPhrase);
  const [draft, setDraft] = useState("");

  const addDraft = (event: FormEvent) => {
    event.preventDefault();
    if (onPhrase(draft)) setDraft("");
  };

  return (
    <div className="speech">
      <p className="speech-lead">Speak to add words to the same conversation.</p>
      <div className="speech-heard" aria-live="polite">
        {speech.listening && speech.interim ? (
          <span className="interim">{speech.interim}</span>
        ) : speech.listening ? (
          <span className="muted">Listening…</span>
        ) : speech.supported ? (
          <span className="muted">Mic is off</span>
        ) : (
          <span className="muted">Microphone unavailable</span>
        )}
      </div>

      {speech.supported ? (
        <div className="speech-controls">
          {speech.listening ? (
            <button type="button" onClick={speech.stop} aria-pressed="true">
              Stop Mic
            </button>
          ) : (
            <button type="button" className="primary" onClick={speech.start} aria-pressed="false">
              Start Mic
            </button>
          )}
        </div>
      ) : (
        <p className="error">Speech recognition isn't available in this browser. Type below instead.</p>
      )}
      {speech.error && <p className="error">{speech.error}</p>}

      <form className="speech-type" onSubmit={addDraft}>
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Or type a word or phrase"
          aria-label="Type a word or phrase"
          maxLength={200}
        />
        <button type="submit" disabled={!draft.trim()}>
          Add
        </button>
      </form>
    </div>
  );
}
