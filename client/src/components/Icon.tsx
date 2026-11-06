type Name = "camera" | "mic" | "speak" | "save" | "clear" | "copy" | "undo" | "trash";

export function Icon({ name }: { name: Name }) {
  const common = {
    viewBox: "0 0 24 24",
    width: 20,
    height: 20,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (name) {
    case "camera":
      return (
        <svg {...common}>
          <path d="M4 8h3l2-2h6l2 2h3v11H4z" />
          <circle cx="12" cy="13" r="3.2" />
        </svg>
      );
    case "mic":
      return (
        <svg {...common}>
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M6 11a6 6 0 0 0 12 0M12 17v4M8 21h8" />
        </svg>
      );
    case "speak":
      return (
        <svg {...common}>
          <path d="M4 10v4h3l5 4V6L7 10z" />
          <path d="M16 9.5a3.5 3.5 0 0 1 0 5M18.5 7a7 7 0 0 1 0 10" />
        </svg>
      );
    case "save":
      return (
        <svg {...common}>
          <path d="M5 4h11l3 3v13H5z" />
          <path d="M8 4v5h7M8 20v-6h8v6" />
        </svg>
      );
    case "clear":
      return (
        <svg {...common}>
          <path d="M5 7h14M9 7V5h6v2M8 7l1 13h6l1-13" />
        </svg>
      );
    case "copy":
      return (
        <svg {...common}>
          <rect x="8" y="8" width="11" height="12" rx="1.5" />
          <path d="M5 16V5h11" />
        </svg>
      );
    case "undo":
      return (
        <svg {...common}>
          <path d="M8 8H5v3" />
          <path d="M5 11a7 7 0 1 0 2-5.2L5 8" />
        </svg>
      );
    case "trash":
      return (
        <svg {...common}>
          <path d="M5 7h14M9 7V5h6v2M8 7l1 13h6l1-13" />
        </svg>
      );
  }
}
