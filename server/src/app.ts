import express from "express";
import type { SignRepository, TranscriptRepository } from "./repositories/types.js";
import { signsRouter } from "./routes/signs.js";
import { transcriptsRouter } from "./routes/transcripts.js";

export interface AppDependencies {
  signs: SignRepository;
  transcripts: TranscriptRepository;
}

export function createApp({ signs, transcripts }: AppDependencies) {
  const app = express();
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });
  app.use("/api/signs", signsRouter(signs));
  app.use("/api/transcripts", transcriptsRouter(transcripts));

  return app;
}
