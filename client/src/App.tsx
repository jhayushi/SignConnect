import { useCallback, useEffect, useMemo, useState } from "react";
import { api, type Transcript } from "./api/client";
import { CameraView } from "./components/CameraView";
import { DetectionPanel } from "./components/DetectionPanel";
import { HistoryView } from "./components/HistoryView";
import { PracticeView } from "./components/PracticeView";
import { SentenceBar } from "./components/SentenceBar";
import { SpeechPanel } from "./components/SpeechPanel";
import { useSentenceBuilder } from "./hooks/useSentenceBuilder";
import { useSigns } from "./hooks/useSigns";
import type { RecognitionResult } from "./recognition";
import { speakText } from "./speech/speak";

export default function App() {
  const { signs, error: signsError } = useSigns();
  const sentence = useSentenceBuilder();
  const [detection, setDetection] = useState<{ word: string | null; confidence: number }>({
    word: null,
    confidence: 0,
  });
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [view, setView] = useState<"talk" | "practice" | "history">("talk");
  const [cameraStatus, setCameraStatus] = useState<"idle" | "loading" | "running" | "error">("idle");
  const [handSeen, setHandSeen] = useState(false);
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(() => {
    try {
      return localStorage.getItem("signconnect.hintSeen") !== "1";
    } catch {
      return true;
    }
  });

  const wordByGesture = useMemo(() => new Map(signs.map((s) => [s.gesture, s.word])), [signs]);

  useEffect(() => {
    api.listTranscripts().then(setTranscripts).catch(() => {});
  }, []);

  const { push } = sentence;
  const handleResult = useCallback(
    (result: RecognitionResult) => {
      setHandSeen(result.landmarks.some((hand) => hand.length > 0));
      const word = result.label ? wordByGesture.get(result.label) ?? null : null;
      setDetection({ word, confidence: result.confidence });
      const added = push(word, result.confidence);
      if (added) {
        setLastAdded(added);
        setNotice(`Added: ${added}`);
        window.setTimeout(() => setNotice(null), 2000);
        speakText(added);
      }
    },
    [wordByGesture, push],
  );

  const flash = (message: string) => {
    setNotice(message);
    setTimeout(() => setNotice(null), 2000);
  };

  const text = sentence.words.join(" ");

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      flash("Copied to clipboard");
    } catch {
      flash("Could not copy");
    }
  };

  const handleSpeak = () => {
    if (!speakText(text)) flash("Speech output isn't available in this browser.");
  };

  const handleSave = async () => {
    try {
      const saved = await api.createTranscript(text);
      setTranscripts((prev) => [saved, ...prev]);
      sentence.clear();
      flash("Sentence saved");
    } catch {
      flash("Could not save. Is the server running?");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteTranscript(id);
      setTranscripts((prev) => prev.filter((t) => t.id !== id));
    } catch {
      flash("Could not delete");
    }
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <h1>SignConnect</h1>
          <p className="tagline">Sign or speak. One conversation.</p>
        </div>
        <nav className="nav" aria-label="Sections">
          <button type="button" aria-pressed={view === "talk"} onClick={() => setView("talk")}>Talk</button>
          <button type="button" aria-pressed={view === "practice"} onClick={() => setView("practice")}>Practice</button>
          <button type="button" aria-pressed={view === "history"} onClick={() => setView("history")}>History</button>
        </nav>
        {notice && <p className="notice" role="status">{notice}</p>}
      </header>

      {signsError && <div className="banner error">{signsError}</div>}

      <main>
        <section className={view === "talk" ? "inputs" : "inputs inputs-single"} hidden={view === "history"}>
          <div className="panel input-card">
            <h2>Your camera</h2>
            {view === "talk" && showHint && (
              <ol className="first-run">
                <li><strong>Allow the camera.</strong> Press Start camera and choose Allow.</li>
                <li><strong>Hold a sign</strong> for about one second.</li>
                <li><strong>Words appear below</strong> and are spoken aloud.</li>
                <li className="first-run-action">
                  <button
                    type="button"
                    onClick={() => {
                      setShowHint(false);
                      try {
                        localStorage.setItem("signconnect.hintSeen", "1");
                      } catch {
                        /* keep the hint dismissed for this visit */
                      }
                    }}
                  >
                    Got it
                  </button>
                </li>
              </ol>
            )}
            <CameraView onResult={handleResult} onStatus={setCameraStatus} />
            <DetectionPanel
              word={detection.word}
              confidence={detection.confidence}
              progress={sentence.progress}
              cameraStatus={cameraStatus}
              handSeen={handSeen}
              lastAdded={lastAdded}
            />
          </div>
          {view === "talk" && (
            <div className="panel input-card">
              <h2>Your microphone</h2>
              <SpeechPanel onPhrase={sentence.addText} />
            </div>
          )}
        </section>

        {view === "talk" && (
          <SentenceBar
            words={sentence.words}
            onUndo={sentence.undo}
            onClear={sentence.clear}
            onCopy={handleCopy}
            onSpeak={handleSpeak}
            onSave={handleSave}
          />
        )}
        {view === "practice" && <PracticeView signs={signs} activeWord={detection.word} />}
        {view === "history" && <HistoryView transcripts={transcripts} onDelete={handleDelete} />}
      </main>
    </div>
  );
}
