export interface Sign {
  id: string;
  gesture: string;
  word: string;
  description: string;
  source: "mediapipe" | "landmarks";
}

export interface Transcript {
  id: string;
  text: string;
  createdAt: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) throw new Error(`Request failed: ${res.status} ${res.statusText}`);
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export const api = {
  listSigns: () => request<Sign[]>("/signs"),
  listTranscripts: () => request<Transcript[]>("/transcripts"),
  getTranscript: (id: string) => request<Transcript>(`/transcripts/${id}`),
  createTranscript: (text: string) =>
    request<Transcript>("/transcripts", { method: "POST", body: JSON.stringify({ text }) }),
  deleteTranscript: (id: string) => request<void>(`/transcripts/${id}`, { method: "DELETE" }),
};
