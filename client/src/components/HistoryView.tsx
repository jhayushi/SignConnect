import { useEffect, useState } from "react";
import { api, type Transcript } from "../api/client";

interface Props {
  transcripts: Transcript[];
  onDelete: (id: string) => void;
}

export function HistoryView({ transcripts, onDelete }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(transcripts[0]?.id ?? null);
  const [viewed, setViewed] = useState<Transcript | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedId) {
      if (transcripts[0]) setSelectedId(transcripts[0].id);
      else setViewed(null);
      return;
    }
    if (!transcripts.some((transcript) => transcript.id === selectedId)) {
      setSelectedId(transcripts[0]?.id ?? null);
      return;
    }
    let cancelled = false;
    api
      .getTranscript(selectedId)
      .then((transcript) => {
        if (!cancelled) {
          setViewed(transcript);
          setError(null);
        }
      })
      .catch(() => {
        if (!cancelled) setError("Could not load that conversation.");
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId, transcripts]);

  return (
    <div className="history">
      <div className="panel">
        <h2>Saved conversations</h2>
        {transcripts.length === 0 ? (
          <p className="muted">Nothing saved yet.</p>
        ) : (
          <ul className="saved-list">
            {transcripts.map((transcript) => (
              <li key={transcript.id} className={transcript.id === selectedId ? "active" : ""}>
                <button type="button" className="history-open" onClick={() => setSelectedId(transcript.id)}>
                  <span>{transcript.text}</span>
                  <span className="muted">{new Date(transcript.createdAt).toLocaleString()}</span>
                </button>
                <button
                  className="link"
                  onClick={() => onDelete(transcript.id)}
                  aria-label={`Delete ${transcript.text}`}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="panel">
        <h2>View</h2>
        {error && <p className="error">{error}</p>}
        {!viewed ? (
          <p className="muted">Choose a saved conversation to read it.</p>
        ) : (
          <>
            <p className="history-text">{viewed.text}</p>
            <p className="muted">{new Date(viewed.createdAt).toLocaleString()}</p>
            <button type="button" onClick={() => onDelete(viewed.id)}>
              Delete
            </button>
          </>
        )}
      </div>
    </div>
  );
}
