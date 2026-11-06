interface Props {
  words: string[];
  onUndo: () => void;
  onClear: () => void;
  onCopy: () => void;
  onSave: () => void;
}

export function SentenceBar({ words, onUndo, onClear, onCopy, onSave }: Props) {
  const empty = words.length === 0;
  return (
    <div className="panel sentence">
      <h2>Conversation</h2>
      <div className="sentence-text" aria-live="polite">
        {empty ? (
          <span className="muted">Hold a sign for about a second, or speak, to add a word…</span>
        ) : (
          words.join(" ")
        )}
      </div>
      <div className="sentence-actions">
        <button onClick={onUndo} disabled={empty}>Undo</button>
        <button onClick={onClear} disabled={empty}>Clear</button>
        <button onClick={onCopy} disabled={empty}>Copy</button>
        <button className="primary" onClick={onSave} disabled={empty}>Save</button>
      </div>
    </div>
  );
}
