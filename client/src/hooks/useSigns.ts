import { useEffect, useState } from "react";
import { api, type Sign } from "../api/client";

export function useSigns() {
  const [signs, setSigns] = useState<Sign[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listSigns()
      .then(setSigns)
      .catch(() => setError("Could not load signs. Is the server running?"));
  }, []);

  return { signs, error };
}
