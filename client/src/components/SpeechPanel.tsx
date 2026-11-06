import { useState, type FormEvent } from "react";
import { useSpeechInput } from "../hooks/useSpeechInput";
import { Icon } from "./Icon";

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
      <p className="speech-lead">Use the mic, or type, to add words to this same conversation.</p>
      <div className="speech-heard" aria-live="polite">
        {speech.listening && speech.interim ? (
          <span className="interim">{speech.interim}</span>
        ) : speech.listening ? (
          <span className="muted">Listening…</span>
        ) : speech.supported ? (
          <span className="muted">Mic is off</span>
        ) : (
          <span className="muted">This browser cannot hear speech. Type instead.</span>
        )}
      </div>

      {speech.supported ? (
        <div className="speech-controls">
          {speech.listening ? (
            <button type="button" onClick={speech.stop} aria-pressed="true">
              <Icon name="mic" />Stop mic
            </button>
          ) : (
            <button type="button" onClick={speech.start} aria-pressed="false">
              <Icon name="mic" />Start mic
            </button>
          )}
        </div>
      ) : (
        <p className="error">Speech recognition is not available in this browser. Type a phrase below and press Add.</p>
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
