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
  { id: "gesture", label: "Easy gestures" },
  { id: "letter", label: "Letters" },
  { id: "number", label: "Numbers" },
];

export function PracticeView({ signs, activeWord }: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const needle = query.trim().toLowerCase();

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: signs.length, gesture: 0, word: 0, letter: 0, number: 0 };
    for (const sign of signs) c[category(sign)] += 1;
    return c;
  }, [signs]);

  const visible = useMemo(
    () =>
      signs.filter((sign) => {
        if (filter !== "all" && category(sign) !== filter) return false;
        if (!needle) return true;
        return `${sign.word} ${sign.description}`.toLowerCase().includes(needle);
      }),
    [signs, filter, needle],
  );

  return (
    <section className="practice">
      <div className="tabs-row">
        <div className="tabs" role="tablist" aria-label="Sign groups">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={filter === item.id}
              className="tab"
              onClick={() => setFilter(item.id)}
            >
              {item.label} <span className="muted">{counts[item.id]}</span>
            </button>
          ))}
        </div>
        <input
          className="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search signs"
          aria-label="Search signs"
        />
      </div>

      {visible.length === 0 ? (
        <p className="empty">No signs match “{query}”.</p>
      ) : (
        <ul className="sign-grid">
          {visible.map((sign) => (
            <li key={sign.id} className={sign.word === activeWord ? "sign-card is-active" : "sign-card"}>
              <div className="sign-tile">
                <span className="sign-word">{sign.word}</span>
                {sign.word === activeWord && <span className="seen">✓ Seen</span>}
              </div>
              <p className="sign-desc">{sign.description}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
