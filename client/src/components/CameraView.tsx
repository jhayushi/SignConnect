import { useCallback, useEffect, useRef, useState } from "react";
import { DrawingUtils, GestureRecognizer } from "@mediapipe/tasks-vision";
import { createRecognizer, type RecognitionResult, type SignRecognizer } from "../recognition";
import { Icon } from "./Icon";

type Status = "idle" | "loading" | "running" | "error";

interface Props {
  onResult: (result: RecognitionResult) => void;
  onStatus?: (status: Status) => void;
}

export function CameraView({ onResult, onStatus }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const recognizerRef = useRef<SignRecognizer | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const onStatusRef = useRef(onStatus);
  onStatusRef.current = onStatus;

  const updateStatus = (next: Status) => {
    setStatus(next);
    onStatusRef.current?.(next);
  };

  const stop = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    canvasRef.current?.getContext("2d")?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    onResultRef.current({ label: null, confidence: 0, landmarks: [] });
    updateStatus("idle");
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
          drawing.drawConnectors(hand, GestureRecognizer.HAND_CONNECTIONS, { color: "#f3e6d0", lineWidth: 4 });
          drawing.drawLandmarks(hand, { color: "#c45c26", radius: 3 });
        }

        onResultRef.current(result);
      }
      frameRef.current = requestAnimationFrame(tick);
    };
    tick();
  }, []);

  const start = useCallback(async () => {
    updateStatus("loading");
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
      updateStatus("running");
      loop();
    } catch (err) {
      console.error(err);
      const denied = err instanceof DOMException && err.name === "NotAllowedError";
      setError(
        denied
          ? "The browser blocked the camera. Use the camera or lock icon in the address bar, choose Allow, then press Start camera again."
          : "The camera or the recognition model did not start. Check that a camera is connected, then try again.",
      );
      stop();
      updateStatus("error");
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
            {status === "loading" ? "Starting the camera…" : status === "error" ? "Camera is blocked" : "Camera is off"}
          </div>
        )}
      </div>
      <div className="camera-controls">
        {status === "running" ? (
          <button type="button" onClick={stop}><Icon name="camera" />Stop camera</button>
        ) : (
          <button className="primary camera-start" type="button" onClick={start} disabled={status === "loading"}>
            <Icon name="camera" />
            {status === "loading" ? "Starting…" : "Start camera"}
          </button>
        )}
        {error && <p className="error camera-help">{error}</p>}
      </div>
    </div>
  );
}
