import { useEffect, useRef, useState } from "react";
import { api, type Sign } from "../api/client";
import { EmaLandmarkFilter, normalizeLandmarks } from "../recognition/signal";
import type { Point } from "../recognition";

interface Props {
  signs: Sign[];
  landmarksRef: { current: Point[] | null };
}

export function SampleRecorder({ signs, landmarksRef }: Props) {
  const [enabled, setEnabled] = useState(false);
  const [label, setLabel] = useState(signs[0]?.gesture ?? "");
  const [count, setCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const buffer = useRef<{ label: string; landmarks: { x: number; y: number; z: number }[] }[]>([]);

  useEffect(() => {
    if (!label && signs[0]) setLabel(signs[0].gesture);
  }, [label, signs]);

  const refresh = () => {
    api.sampleCount(label || undefined).then((row) => setCount(row.count)).catch(() => setError("Could not load sample count."));
  };

  useEffect(() => {
    api
      .sampleCount(label || undefined)
      .then((row) => setCount(row.count))
      .catch(() => setError("Could not load sample count."));
  }, [label]);

  const flush = async () => {
    const batch = buffer.current.splice(0, buffer.current.length);
    if (batch.length === 0) return;
    try {
      await api.createSamples(batch);
      setError(null);
      refresh();
    } catch {
      setError("Could not save samples. Is the server running?");
    }
  };

  useEffect(() => {
    if (!enabled || !label) return;
    const smoother = new EmaLandmarkFilter(0.45);
    const timer = window.setInterval(() => {
      const raw = landmarksRef.current;
      if (!raw || raw.length < 21) return;
      const smoothed = smoother.apply(raw);
      const normalized = normalizeLandmarks(smoothed).map((point) => ({ x: point.x, y: point.y, z: point.z }));
      buffer.current.push({ label, landmarks: normalized });
      if (buffer.current.length >= 8) void flush();
    }, 200);
    return () => {
      window.clearInterval(timer);
      void flush();
    };
  }, [enabled, label]);

  return (
    <div className="panel recorder">
      <h2>Record landmarks</h2>
      <p className="muted sign-hint">
        Off unless you turn it on. Samples are smoothed, moved to the wrist, scaled, then stored in the database.
      </p>
      <div className="recorder-row">
        <button type="button" aria-pressed={enabled} onClick={() => setEnabled((on) => !on)}>
          {enabled ? "Stop recording" : "Start recording"}
        </button>
        <select aria-label="Sample label" value={label} onChange={(event) => setLabel(event.target.value)}>
          {signs.map((sign) => (
            <option key={sign.id} value={sign.gesture}>
              {sign.word}
            </option>
          ))}
        </select>
        <span className="muted">{count} saved for this label</span>
      </div>
      <div className="recorder-row">
        <button type="button" onClick={() => api.downloadSamples("csv", label).catch(() => setError("Could not export CSV."))}>
          Export CSV
        </button>
        <button type="button" onClick={() => api.downloadSamples("json", label).catch(() => setError("Could not export JSON."))}>
          Export JSON
        </button>
        <button
          type="button"
          onClick={() => {
            api.clearSamples(label).then(() => refresh()).catch(() => setError("Could not delete samples."));
          }}
        >
          Delete saved
        </button>
      </div>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
