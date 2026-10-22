import { Router } from "express";
import type { TranscriptRepository } from "../repositories/types.js";

const MAX_TEXT_LENGTH = 1000;

export function transcriptsRouter(transcripts: TranscriptRepository): Router {
  const router = Router();

  router.get("/", async (_req, res) => {
    res.json(await transcripts.list());
  });

  router.post("/", async (req, res) => {
    const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
    if (!text || text.length > MAX_TEXT_LENGTH) {
      res.status(400).json({ error: `text must be a non-empty string up to ${MAX_TEXT_LENGTH} characters` });
      return;
    }
    res.status(201).json(await transcripts.create(text));
  });

  router.delete("/:id", async (req, res) => {
    const deleted = await transcripts.delete(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: "Transcript not found" });
      return;
    }
    res.status(204).end();
  });

  return router;
}
