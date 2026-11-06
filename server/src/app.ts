import express from "express";
import type { SampleRepository, SignRepository, TranscriptRepository } from "./repositories/types.js";
import { samplesRouter } from "./routes/samples.js";
import { signsRouter } from "./routes/signs.js";
import { transcriptsRouter } from "./routes/transcripts.js";

export interface AppDependencies {
  signs: SignRepository;
  transcripts: TranscriptRepository;
  samples: SampleRepository;
}

export function createApp({ signs, transcripts, samples }: AppDependencies) {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });
  app.use("/api/signs", signsRouter(signs));
  app.use("/api/transcripts", transcriptsRouter(transcripts));
  app.use("/api/samples", samplesRouter(samples));

  return app;
}
