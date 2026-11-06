import type { Transcript } from "../api/client";
import { speakText } from "../speech/speak";

interface Props {
  transcripts: Transcript[];
  onDelete: (id: string) => void;
  onStart: () => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function HistoryView({ transcripts, onDelete, onStart }: Props) {
  if (transcripts.length === 0) {
    return (
      <div className="empty-state">
        <p className="serif-title">Nothing saved yet</p>
        <p className="muted">Have a conversation on the Talk page, then press “Save conversation”.</p>
        <button className="btn btn-dark" onClick={onStart}>
          Start talking <span aria-hidden="true">↗</span>
        </button>
      </div>
    );
  }

  return (
    <ul className="history-list">
      {transcripts.map((transcript) => (
        <li key={transcript.id} className="history-item">
          <div className="history-meta">
            <span className="avatar" aria-hidden="true">
              {transcript.text.trim().charAt(0).toUpperCase() || "·"}
            </span>
            <span className="muted">{formatDate(transcript.createdAt)}</span>
          </div>
          <p className="history-text">{transcript.text.toLowerCase()}</p>
          <div className="history-actions">
            <button type="button" className="btn btn-outline btn-sm" onClick={() => speakText(transcript.text)}>
              🔊 Read aloud
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => onDelete(transcript.id)}
              aria-label={`Delete “${transcript.text}”`}
            >
              Delete
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
