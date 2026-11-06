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
    <div className="card speech">
      <p className="eyebrow">The other person</p>
      <div className="speech-row">
        {speech.supported && (
          <button
            type="button"
            className={`mic ${speech.listening ? "mic-on" : ""}`}
            onClick={speech.listening ? speech.stop : speech.start}
            aria-pressed={speech.listening}
            aria-label={speech.listening ? "Stop listening" : "Start listening"}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
              <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
              <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
            </svg>
          </button>
        )}
        <div className="speech-heard" aria-live="polite">
          {speech.listening && speech.interim ? (
            <span className="interim">“{speech.interim}”</span>
          ) : speech.listening ? (
            <span>Listening… speak now</span>
          ) : speech.supported ? (
            <span className="muted">Tap the mic to speak</span>
          ) : (
            <span className="muted">Voice input isn't supported in this browser. Type instead.</span>
          )}
        </div>
      </div>
      {speech.error && <p className="error">{speech.error}</p>}

      <form className="speech-type" onSubmit={addDraft}>
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="…or type a reply"
          aria-label="Type a word or phrase"
          maxLength={200}
        />
        <button type="submit" className="btn btn-dark" disabled={!draft.trim()}>
          Add
        </button>
      </form>
    </div>
  );
}
