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

  const wordByGesture = useMemo(() => new Map(signs.map((s) => [s.gesture, s.word])), [signs]);

  useEffect(() => {
    api.listTranscripts().then(setTranscripts).catch(() => {});
  }, []);

  const { push } = sentence;
  const handleResult = useCallback(
    (result: RecognitionResult) => {
      const word = result.label ? wordByGesture.get(result.label) ?? null : null;
      setDetection({ word, confidence: result.confidence });
      const added = push(word, result.confidence);
      if (added) speakText(added);
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
      <header>
        <div>
          <h1>SignConnect</h1>
          <p className="tagline">Camera and microphone share one conversation.</p>
        </div>
        {notice && <span className="notice">{notice}</span>}
      </header>

      {signsError && <div className="banner error">{signsError}</div>}

      <nav className="views" aria-label="Sections">
        <button type="button" aria-pressed={view === "talk"} onClick={() => setView("talk")}>Talk</button>
        <button type="button" aria-pressed={view === "practice"} onClick={() => setView("practice")}>Practice</button>
        <button type="button" aria-pressed={view === "history"} onClick={() => setView("history")}>History</button>
      </nav>

      <main>
        <section className={view === "talk" ? "inputs" : "inputs inputs-single"} hidden={view === "history"}>
          <div className="panel input-card">
            <h2>ASL · camera</h2>
            <CameraView onResult={handleResult} />
            <DetectionPanel word={detection.word} confidence={detection.confidence} progress={sentence.progress} />
          </div>
          {view === "talk" && (
            <div className="panel input-card">
              <h2>Speech · microphone</h2>
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
