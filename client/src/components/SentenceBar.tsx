import { Icon } from "./Icon";

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
    <div className="panel sentence">
      <h2>Conversation</h2>
      <div className="sentence-text" aria-live="polite">
        {empty ? (
          <span className="muted">Words you sign or say will show up here, in large type.</span>
        ) : (
          words.join(" ")
        )}
      </div>
      <div className="sentence-actions">
        <button type="button" onClick={onUndo} disabled={empty}><Icon name="undo" />Undo</button>
        <button type="button" onClick={onClear} disabled={empty}><Icon name="clear" />Clear</button>
        <button type="button" onClick={onCopy} disabled={empty}><Icon name="copy" />Copy</button>
        <button type="button" onClick={onSpeak} disabled={empty}><Icon name="speak" />Speak</button>
        <button type="button" className="primary" onClick={onSave} disabled={empty}><Icon name="save" />Save</button>
      </div>
    </div>
  );
}
