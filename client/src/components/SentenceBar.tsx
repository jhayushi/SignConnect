interface Props {
  words: string[];
  onUndo: () => void;
  onClear: () => void;
  onCopy: () => void;
  onSpeak: () => void;
  onSave: () => void;
}

export function SentenceBar({ words, onUndo, onClear, onCopy, onSpeak, onSave }: Props) {
  const empty = words.length === 0;
  return (
    <section className="conversation">
      <div className="conversation-head">
        <h2 className="serif-title">Conversation</h2>
        <span className="muted">{empty ? "Nothing yet" : `${words.length} word${words.length === 1 ? "" : "s"}`}</span>
      </div>
      <div className="conversation-text" aria-live="polite">
        {empty ? (
          <span className="placeholder">Words appear here as you sign, speak, or type.</span>
        ) : (
          words.map((word, i) => (
            <span key={i} className={i === words.length - 1 ? "word word-new" : "word"}>
              {word.toLowerCase()}{" "}
            </span>
          ))
        )}
      </div>
      <div className="conversation-actions">
        <div className="group">
          <button className="btn btn-ghost" onClick={onUndo} disabled={empty} title="Remove the last word">
            ↶ Undo
          </button>
          <button className="btn btn-ghost" onClick={onClear} disabled={empty}>
            Clear
          </button>
          <button className="btn btn-ghost" onClick={onCopy} disabled={empty}>
            Copy
          </button>
        </div>
        <div className="group">
          <button className="btn btn-outline" onClick={onSpeak} disabled={empty}>
            🔊 Read aloud
          </button>
          <button className="btn btn-dark" onClick={onSave} disabled={empty}>
            Save conversation
          </button>
        </div>
      </div>
    </section>
  );
}
