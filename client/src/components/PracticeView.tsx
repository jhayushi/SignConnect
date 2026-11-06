import { useMemo, useState } from "react";
import type { Sign } from "../api/client";

interface Props {
  signs: Sign[];
  activeWord: string | null;
}

type Filter = "all" | "gesture" | "word" | "letter" | "number";

function category(sign: Sign): Exclude<Filter, "all"> {
  if (sign.source === "mediapipe") return "gesture";
  if (sign.gesture.startsWith("Letter")) return "letter";
  if (sign.gesture.startsWith("Number")) return "number";
  return "word";
}

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "word", label: "Words" },
  { id: "letter", label: "Letters" },
  { id: "number", label: "Numbers" },
  { id: "gesture", label: "Gestures" },
];

export function PracticeView({ signs, activeWord }: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const needle = query.trim().toLowerCase();

  const visible = useMemo(
    () =>
      signs.filter((sign) => {
        if (filter !== "all" && category(sign) !== filter) return false;
        if (!needle) return true;
        return `${sign.word} ${sign.description}`.toLowerCase().includes(needle);
      }),
    [signs, filter, needle],
  );

  const active = signs.find((sign) => sign.word === activeWord) ?? null;

  return (
    <div className="panel practice">
      <h2>Practice</h2>
      <p className="muted sign-hint">
        {signs.length} signs from the server. Hold one for about 0.6 seconds. The card lights up when the camera sees it.
      </p>
      <div className="practice-now" aria-live="polite">
        {active ? (
          <>
            <strong>{active.word}</strong>
            <span className="muted">{active.description}</span>
          </>
        ) : (
          <span className="muted">No sign in frame yet.</span>
        )}
      </div>
      <div className="practice-tools">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search signs"
          aria-label="Search signs"
        />
        <div className="practice-filters" role="group" aria-label="Sign groups">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={filter === item.id}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      {visible.length === 0 ? (
        <p className="muted">No signs match that search.</p>
      ) : (
        <ul className="practice-grid">
          {visible.map((sign) => (
            <li key={sign.id} className={sign.word === activeWord ? "active" : ""}>
              <strong>{sign.word}</strong>
              <span className="muted">{sign.description}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
