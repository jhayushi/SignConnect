import { useCallback, useEffect, useMemo, useState } from "react";
import { api, type Transcript } from "./api/client";
import { CameraView } from "./components/CameraView";
import { DetectionPanel } from "./components/DetectionPanel";
import { SavedSentences } from "./components/SavedSentences";
import { SentenceBar } from "./components/SentenceBar";
import { SignList } from "./components/SignList";
import { SpeechPanel } from "./components/SpeechPanel";
import { useSentenceBuilder } from "./hooks/useSentenceBuilder";
import { useSigns } from "./hooks/useSigns";
import type { RecognitionResult } from "./recognition";

export default function App() {
  const { signs, error: signsError } = useSigns();
  const sentence = useSentenceBuilder();
  const [detection, setDetection] = useState<{ word: string | null; confidence: number }>({
    word: null,
    confidence: 0,
  });
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const wordByGesture = useMemo(() => new Map(signs.map((s) => [s.gesture, s.word])), [signs]);

  useEffect(() => {
    api.listTranscripts().then(setTranscripts).catch(() => {});
  }, []);

  const { push } = sentence;
  const handleResult = useCallback(
    (result: RecognitionResult) => {
      const word = result.label ? wordByGesture.get(result.label) ?? null : null;
      setDetection({ word, confidence: result.confidence });
      push(word, result.confidence);
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

      <main>
        <section className="inputs">
          <div className="panel input-card">
            <h2>ASL · camera</h2>
            <CameraView onResult={handleResult} />
            <DetectionPanel word={detection.word} confidence={detection.confidence} progress={sentence.progress} />
          </div>
          <div className="panel input-card">
            <h2>Speech · microphone</h2>
            <SpeechPanel onPhrase={sentence.addText} />
          </div>
        </section>

        <SentenceBar
          words={sentence.words}
          onUndo={sentence.undo}
          onClear={sentence.clear}
          onCopy={handleCopy}
          onSave={handleSave}
        />

        <section className="bottom">
          <SignList signs={signs} activeWord={detection.word} />
          <SavedSentences transcripts={transcripts} onDelete={handleDelete} />
        </section>
      </main>
    </div>
  );
}
