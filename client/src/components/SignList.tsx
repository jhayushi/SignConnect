import type { Sign } from "../api/client";

interface Props {
  signs: Sign[];
  activeWord: string | null;
}

export function SignList({ signs, activeWord }: Props) {
  return (
    <div className="panel">
      <h2>Supported signs</h2>
      <ul className="sign-list">
        {signs.map((s) => (
          <li key={s.id} className={s.word === activeWord ? "active" : ""}>
            <strong>{s.word}</strong>
            <span className="muted">{s.description}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
