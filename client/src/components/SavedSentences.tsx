import type { Transcript } from "../api/client";

interface Props {
  transcripts: Transcript[];
  onDelete: (id: string) => void;
}

export function SavedSentences({ transcripts, onDelete }: Props) {
  return (
    <div className="panel">
      <h2>Saved sentences</h2>
      {transcripts.length === 0 ? (
        <p className="muted">Nothing saved yet.</p>
      ) : (
        <ul className="saved-list">
          {transcripts.map((t) => (
            <li key={t.id}>
              <span>{t.text}</span>
              <span className="muted">{new Date(t.createdAt).toLocaleTimeString()}</span>
              <button className="link" onClick={() => onDelete(t.id)} aria-label="Delete">✕</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
