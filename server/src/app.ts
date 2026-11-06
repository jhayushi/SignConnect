import fs from "node:fs";
import path from "node:path";
import express from "express";
import type { SignRepository, TranscriptRepository } from "./repositories/types.js";
import { signsRouter } from "./routes/signs.js";
import { transcriptsRouter } from "./routes/transcripts.js";

export interface AppDependencies {
  signs: SignRepository;
  transcripts: TranscriptRepository;
}

export interface AppOptions {
  /** Built client directory. When it contains index.html, the site and /api share this server. */
  clientDist?: string;
}

export function createApp({ signs, transcripts }: AppDependencies, options: AppOptions = {}) {
  const app = express();
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });
  app.use("/api/signs", signsRouter(signs));
  app.use("/api/transcripts", transcriptsRouter(transcripts));

  const clientDist = options.clientDist;
  const indexHtml = clientDist ? path.join(clientDist, "index.html") : "";
  if (clientDist && fs.existsSync(indexHtml)) {
    app.use(express.static(clientDist));
    app.use((req, res, next) => {
      if (req.method !== "GET" || req.path.startsWith("/api")) {
        next();
        return;
      }
      res.sendFile(indexHtml);
    });
  }

  return app;
}
