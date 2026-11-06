import { FRAMING_MESSAGES, type FramingTip } from "../recognition/framing";

interface Props {
  word: string | null;
  confidence: number;
  progress: number;
  tip: FramingTip | null;
  lastAdded: string | null;
}

export function DetectionPanel({ word, confidence, progress, tip, lastAdded }: Props) {
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
          {progress > 0 ? "Keep holding…" : word && sure ? "Added — change sign or lower your hand" : "Hold a sign to add it"}
        </span>
      </div>

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
