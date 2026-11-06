interface Props {
  word: string | null;
  confidence: number;
  progress: number;
}

export function DetectionPanel({ word, confidence, progress }: Props) {
  return (
    <div className="detection">
      <h2>Detected</h2>
      <div className="detected-word">{word ?? "—"}</div>
      <label>Confidence {word ? `${Math.round(confidence * 100)}%` : ""}</label>
      <div className="meter">
        <div className="meter-fill" style={{ width: `${word ? confidence * 100 : 0}%` }} />
      </div>
      <label>Hold to add</label>
      <div className="meter">
        <div className="meter-fill hold" style={{ width: `${progress * 100}%` }} />
      </div>
    </div>
  );
}
