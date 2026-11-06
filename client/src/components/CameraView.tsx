import { useCallback, useEffect, useRef, useState } from "react";
import { DrawingUtils, GestureRecognizer } from "@mediapipe/tasks-vision";
import { createRecognizer, type RecognitionResult, type SignRecognizer } from "../recognition";

type Status = "idle" | "loading" | "running" | "error";

interface Props {
  onResult: (result: RecognitionResult, running: boolean) => void;
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
    onResultRef.current({ label: null, confidence: 0, landmarks: [] }, false);
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
          drawing.drawConnectors(hand, GestureRecognizer.HAND_CONNECTIONS, { color: "rgba(255,255,255,0.9)", lineWidth: 3 });
          drawing.drawLandmarks(hand, { color: "#2bb3a6", fillColor: "#2bb3a6", radius: 3 });
        }

        onResultRef.current(result, true);
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
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      setStatus("running");
      loop();
    } catch (err) {
      console.error(err);
      setError(err instanceof DOMException && err.name === "NotAllowedError"
        ? "Camera access was blocked. Allow it in your browser's address bar, then try again."
        : "The camera or the recognition model didn't load. Check your connection and try again.");
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
    <div className={`camera camera-${status}`}>
      <div className="camera-frame">
        {/* Mirrored like a mirror, so moving your right hand moves the right side of the picture. */}
        <video ref={videoRef} playsInline muted />
        <canvas ref={canvasRef} />
        {status === "running" && <span className="live-pill">Live</span>}
        {status !== "running" && (
          <div className="camera-placeholder">
            {status === "loading" ? (
              <>
                <span className="spinner" aria-hidden="true" />
                <p>Getting the camera ready…</p>
                <p className="small">The first start takes a few seconds while the hand model downloads.</p>
              </>
            ) : (
              <>
                <p className="placeholder-title">Your camera is off</p>
                <p className="small">Sit about an arm's length away with good light on your hands.</p>
                <button className="btn btn-dark" onClick={start}>
                  Start camera <span aria-hidden="true">↗</span>
                </button>
                {error && <p className="error">{error}</p>}
              </>
            )}
          </div>
        )}
      </div>
      {status === "running" && (
        <div className="camera-controls">
          <button className="btn btn-ghost" onClick={stop}>
            Stop camera
          </button>
        </div>
      )}
    </div>
  );
}
