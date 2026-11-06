type CameraStatus = "idle" | "loading" | "running" | "error";

interface Props {
  word: string | null;
  confidence: number;
  progress: number;
  cameraStatus: CameraStatus;
  handSeen: boolean;
  lastAdded: string | null;
}

export function DetectionPanel({ word, confidence, progress, cameraStatus, handSeen, lastAdded }: Props) {
  const status = statusLine(cameraStatus, handSeen, word, progress, lastAdded);
  return (
    <div className="detection">
      <p className={cameraStatus === "running" ? "status-line live" : "status-line"} aria-live="polite">{status}</p>
      <div className="detected-word">{word ?? "—"}</div>
      <label>
        Confidence {word ? `${Math.round(confidence * 100)}%` : ""}
      </label>
      <div className="meter" aria-hidden="true">
        <div className="meter-fill" style={{ width: `${word ? confidence * 100 : 0}%` }} />
      </div>
      <label>Hold steady</label>
      <div className="meter" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} aria-label="Hold progress">
        <div className="meter-fill hold" style={{ width: `${progress * 100}%` }} />
      </div>
    </div>
  );
}

function statusLine(
  cameraStatus: CameraStatus,
  handSeen: boolean,
  word: string | null,
  progress: number,
  lastAdded: string | null,
): string {
  if (cameraStatus === "loading") return "Starting the camera…";
  if (cameraStatus === "error") return "Camera needs permission";
  if (cameraStatus !== "running") return "Camera is off";
  if (word && progress > 0 && progress < 1) return "Hold steady…";
  if (!handSeen && !word) return "Looking for your hand…";
  if (lastAdded && word === lastAdded && progress === 0) return `Added: ${lastAdded}`;
  if (word) return "Hold steady…";
  return "Looking for your hand…";
}
