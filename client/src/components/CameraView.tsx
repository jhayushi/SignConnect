import { useCallback, useEffect, useRef, useState } from "react";
import { DrawingUtils, GestureRecognizer } from "@mediapipe/tasks-vision";
import { createRecognizer, type RecognitionResult, type SignRecognizer } from "../recognition";

type Status = "idle" | "loading" | "running" | "error";

interface Props {
  onResult: (result: RecognitionResult) => void;
}

export function CameraView({ onResult }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const recognizerRef = useRef<SignRecognizer | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    canvasRef.current?.getContext("2d")?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    onResultRef.current({ label: null, confidence: 0, landmarks: [] });
    setStatus("idle");
  }, []);

  const loop = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const recognizer = recognizerRef.current;
    if (!video || !canvas || !recognizer) return;

    let lastVideoTime = -1;
    const ctx = canvas.getContext("2d")!;
    const drawing = new DrawingUtils(ctx);

    const tick = () => {
      if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        const result = recognizer.recognize(video, performance.now());

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (const hand of result.landmarks) {
          drawing.drawConnectors(hand, GestureRecognizer.HAND_CONNECTIONS, { color: "#22c55e", lineWidth: 4 });
          drawing.drawLandmarks(hand, { color: "#f97316", radius: 3 });
        }

        onResultRef.current(result);
      }
      frameRef.current = requestAnimationFrame(tick);
    };
    tick();
  }, []);

  const start = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      if (!recognizerRef.current) {
        const recognizer = createRecognizer();
        await recognizer.init();
        recognizerRef.current = recognizer;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false });
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      setStatus("running");
      loop();
    } catch (err) {
      console.error(err);
      setError(err instanceof DOMException && err.name === "NotAllowedError"
        ? "Camera permission was denied."
        : "Could not start the camera or load the recognition model.");
      stop();
      setStatus("error");
    }
  }, [loop, stop]);

  useEffect(
    () => () => {
      stop();
      recognizerRef.current?.close();
      recognizerRef.current = null;
    },
    [stop],
  );

  return (
    <div className="camera">
      <div className="camera-frame">
        <video ref={videoRef} playsInline muted />
        <canvas ref={canvasRef} />
        {status !== "running" && (
          <div className="camera-placeholder">
            {status === "loading" ? "Loading model and camera…" : "Camera is off"}
          </div>
        )}
      </div>
      <div className="camera-controls">
        {status === "running" ? (
          <button onClick={stop}>Stop Camera</button>
        ) : (
          <button className="primary" onClick={start} disabled={status === "loading"}>
            {status === "loading" ? "Starting…" : "Start Camera"}
          </button>
        )}
        {error && <span className="error">{error}</span>}
      </div>
    </div>
  );
}
