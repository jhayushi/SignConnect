import { FRAMING_MESSAGES, type FramingTip } from "../recognition/framing";

interface Props {
  word: string | null;
  confidence: number;
  progress: number;
  tip: FramingTip | null;
  lastAdded: string | null;
  pending: string | null;
  onConfirm: () => void;
  onDismiss: () => void;
}

export function DetectionPanel({ word, confidence, progress, tip, lastAdded, pending, onConfirm, onDismiss }: Props) {
  const sure = word !== null && confidence >= 0.65;
  return (
    <div className="card detection">
      <p className="eyebrow">I see</p>
      <div className={`detected-word ${word ? "" : "is-empty"}`} aria-live="polite">
        {word ?? "…"}
      </div>

      <div className="hold" aria-label="Hold progress">
        <div className="hold-track">
          <div className="hold-fill" style={{ width: `${progress * 100}%` }} />
        </div>
        <span className="hold-label">
          {progress > 0
            ? "Keep holding…"
            : pending
              ? "Is this right? Add it or skip it below"
              : word && sure
                ? "Done — change sign or lower your hand"
                : "Hold a sign for about a second"}
        </span>
      </div>

      {pending && (
        <div className="confirm" role="group" aria-label={`Add ${pending} to the conversation?`}>
          <p className="confirm-question">
            Add <strong>{pending}</strong>?
          </p>
          <div className="confirm-actions">
            <button type="button" className="btn btn-dark" onClick={onConfirm}>
              ✓ Add
            </button>
            <button type="button" className="btn btn-outline" onClick={onDismiss}>
              ✕ Skip
            </button>
          </div>
          <p className="confirm-keys">
            <kbd>Enter</kbd> to add · <kbd>Esc</kbd> to skip
          </p>
        </div>
      )}

      <dl className="detection-facts">
        <div>
          <dt>Certainty</dt>
          <dd>
            <span className={`dot ${!word ? "" : sure ? "dot-good" : "dot-weak"}`} />
            {!word ? "—" : sure ? "Clear" : "Unsure"}
            {word && <span className="muted"> · {Math.round(confidence * 100)}%</span>}
          </dd>
        </div>
        <div>
          <dt>Last added</dt>
          <dd>{lastAdded ?? "—"}</dd>
        </div>
      </dl>

      {tip && <p className={`tip tip-${tip}`}>{FRAMING_MESSAGES[tip]}</p>}
    </div>
  );
}
