import type { Sign } from "../api/client";

interface Props {
  signs: Sign[];
  activeWord: string | null;
}

export function SignList({ signs, activeWord }: Props) {
  const groups = [
    { title: "Gestures", items: signs.filter((sign) => sign.source !== "landmarks") },
    { title: "Conversational signs", items: signs.filter((sign) => sign.source === "landmarks") },
  ].filter((group) => group.items.length > 0);

  return (
    <div className="panel">
      <h2>Supported signs</h2>
      <p className="muted sign-hint">
        Hold a sign for about a second. Two-hand signs need both hands in the frame.
      </p>
      {groups.map((group) => (
        <div className="sign-group" key={group.title}>
          <h3>{group.title}</h3>
          <ul className="sign-list">
            {group.items.map((sign) => (
              <li key={sign.id} className={sign.word === activeWord ? "active" : ""}>
                <strong>{sign.word}</strong>
                <span className="muted">{sign.description}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
