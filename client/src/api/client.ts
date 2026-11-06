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
  sampleCount: (label?: string) => request<{ count: number }>(`/samples${label ? `?label=${encodeURIComponent(label)}` : ""}`),
  createSamples: (samples: { label: string; landmarks: { x: number; y: number; z: number }[] }[]) =>
    request<{ saved: number }>("/samples", { method: "POST", body: JSON.stringify({ samples }) }),
  clearSamples: (label?: string) =>
    request<{ deleted: number }>(`/samples${label ? `?label=${encodeURIComponent(label)}` : ""}`, { method: "DELETE" }),
  async downloadSamples(format: "csv" | "json", label?: string): Promise<void> {
    const query = label ? `?label=${encodeURIComponent(label)}` : "";
    const res = await fetch(`/api/samples/export.${format}${query}`);
    if (!res.ok) throw new Error(`Request failed: ${res.status} ${res.statusText}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `landmarks.${format}`;
    link.click();
    URL.revokeObjectURL(url);
  },
};
