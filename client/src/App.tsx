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
import { framingTip, type FramingTip } from "./recognition/framing";
import { speakText } from "./speech/speak";

type View = "talk" | "practice" | "history";

const NAV: { id: View; label: string }[] = [
  { id: "talk", label: "Talk" },
  { id: "practice", label: "Practice" },
  { id: "history", label: "History" },
];

export default function App() {
  const { signs, error: signsError } = useSigns();
  const [confirmSigns, setConfirmSigns] = useState(true);
  const sentence = useSentenceBuilder(confirmSigns);
  const [detection, setDetection] = useState<{ word: string | null; confidence: number }>({
    word: null,
    confidence: 0,
  });
  const [tip, setTip] = useState<FramingTip | null>(null);
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [view, setView] = useState<View>("talk");
  const [voiceOn, setVoiceOn] = useState(true);

  const wordByGesture = useMemo(() => new Map(signs.map((s) => [s.gesture, s.word])), [signs]);

  useEffect(() => {
    api.listTranscripts().then(setTranscripts).catch(() => {});
  }, []);

  const { push } = sentence;
  const handleResult = useCallback(
    (result: RecognitionResult, running: boolean) => {
      const word = result.label ? wordByGesture.get(result.label) ?? null : null;
      setDetection({ word, confidence: result.confidence });
      setTip(running ? framingTip(result.landmarks) : null);
      const added = push(word, result.confidence);
      if (added) {
        setLastAdded(added);
        if (voiceOn) speakText(added);
      }
    },
    [wordByGesture, push, voiceOn],
  );

  const { confirm, dismiss, pending } = sentence;
  const handleConfirm = useCallback(() => {
    const added = confirm();
    if (added) {
      setLastAdded(added);
      if (voiceOn) speakText(added);
    }
  }, [confirm, voiceOn]);

  // Enter adds the suggested sign, Escape skips it (not while typing in a field).
  useEffect(() => {
    if (!pending) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (event.key === "Enter") {
        event.preventDefault();
        handleConfirm();
      } else if (event.key === "Escape") {
        dismiss();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending, handleConfirm, dismiss]);

  const flash = (message: string) => {
    setNotice(message);
    setTimeout(() => setNotice(null), 2200);
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
      flash("Conversation saved");
    } catch {
      flash("Could not save. Is the server running?");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteTranscript(id);
      setTranscripts((prev) => prev.filter((t) => t.id !== id));
      flash("Deleted");
    } catch {
      flash("Could not delete");
    }
  };

  return (
    <div className="app">
      <header className="topbar">
        <nav className="topnav" aria-label="Sections">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              className="navlink"
              aria-current={view === item.id ? "page" : undefined}
              onClick={() => setView(item.id)}
            >
              {item.label}
              {item.id === "history" && transcripts.length > 0 && (
                <span className="count">{transcripts.length}</span>
              )}
            </button>
          ))}
        </nav>
        <button type="button" className="brand" onClick={() => setView("talk")} aria-label="SignConnect home">
          <Logo />
          <span>SignConnect</span>
        </button>
        <div className="topbar-right">
          <label className="switch" title="Ask before adding each recognized sign">
            <input type="checkbox" checked={confirmSigns} onChange={(e) => setConfirmSigns(e.target.checked)} />
            <span className="switch-track" aria-hidden="true" />
            Confirm each sign
          </label>
          <label className="switch">
            <input type="checkbox" checked={voiceOn} onChange={(e) => setVoiceOn(e.target.checked)} />
            <span className="switch-track" aria-hidden="true" />
            Read signs aloud
          </label>
        </div>
      </header>

      {signsError && <div className="banner">{signsError}</div>}
      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}

      {/* The camera stays mounted on Talk and Practice so switching tabs doesn't restart it. */}
      <main className={`view view-${view}`}>
        {view === "talk" && (
          <section className="intro">
            <p className="eyebrow">Sign &amp; speak</p>
            <h1>
              One conversation,
              <br />
              two languages.
            </h1>
            <ol className="steps">
              <li>
                <span>1</span>Turn on the camera
              </li>
              <li>
                <span>2</span>Hold a sign for about a second
              </li>
              <li>
                <span>3</span>The other person speaks or types
              </li>
            </ol>
          </section>
        )}

        {view === "practice" && (
          <section className="section-head">
            <p className="eyebrow">Learn the vocabulary</p>
            <h1>Practice</h1>
            <p className="lead">Try any sign below. Its card turns green when the camera sees it.</p>
          </section>
        )}

        <div className="stage" hidden={view === "history"}>
          <div className="camera-col">
            <CameraView onResult={handleResult} />
          </div>
          <aside className="side-col">
            <DetectionPanel
              word={detection.word}
              confidence={detection.confidence}
              progress={sentence.progress}
              tip={tip}
              lastAdded={lastAdded}
              pending={sentence.pending}
              onConfirm={handleConfirm}
              onDismiss={sentence.dismiss}
            />
            {view === "talk" && <SpeechPanel onPhrase={sentence.addText} />}
          </aside>
        </div>

        {view === "talk" && (
          <SentenceBar
            words={sentence.words}
            pending={sentence.pending}
            onUndo={sentence.undo}
            onClear={sentence.clear}
            onCopy={handleCopy}
            onSpeak={handleSpeak}
            onSave={handleSave}
          />
        )}
        {view === "practice" && <PracticeView signs={signs} activeWord={detection.word} />}
        {view === "history" && (
          <>
            <section className="section-head">
              <p className="eyebrow">Saved conversations</p>
              <h1>History</h1>
            </section>
            <HistoryView transcripts={transcripts} onDelete={handleDelete} onStart={() => setView("talk")} />
          </>
        )}
      </main>

      <footer className="footer">SignConnect · Recognition runs on your device. Nothing from the camera is uploaded.</footer>
    </div>
  );
}

function Logo() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
      <rect x="1.5" y="6" width="25" height="17" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M9 14.5c0-2 1.5-3.5 3.5-3.5M19 14.5c0 2-1.5 3.5-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <rect x="10" y="2" width="8" height="5" rx="1.5" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
