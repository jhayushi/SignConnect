import { Router } from "express";
import type { LandmarkSample, SampleRepository } from "../repositories/types.js";

const MAX_BATCH = 50;
const MAX_LABEL = 64;

export function samplesRouter(samples: SampleRepository): Router {
  const router = Router();

  router.get("/export.json", async (req, res) => {
    const label = typeof req.query.label === "string" ? req.query.label : undefined;
    const rows = await samples.list(label);
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", "attachment; filename=\"landmarks.json\"");
    res.json(rows);
  });

  router.get("/export.csv", async (req, res) => {
    const label = typeof req.query.label === "string" ? req.query.label : undefined;
    const rows = await samples.list(label);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=\"landmarks.csv\"");
    res.send(toCsv(rows));
  });

  router.get("/", async (req, res) => {
    const label = typeof req.query.label === "string" ? req.query.label : undefined;
    res.json({ count: await samples.count(label) });
  });

  router.post("/", async (req, res) => {
    const batch = parseBatch(req.body);
    if (!batch) {
      res.status(400).json({ error: `samples must be 1 to ${MAX_BATCH} items with a label and 21 landmarks` });
      return;
    }
    const saved = await samples.createMany(batch);
    res.status(201).json({ saved });
  });

  router.delete("/", async (req, res) => {
    const label = typeof req.query.label === "string" ? req.query.label : undefined;
    const deleted = await samples.clear(label);
    res.json({ deleted });
  });

  router.delete("/:id", async (req, res) => {
    const deleted = await samples.delete(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: "Sample not found" });
      return;
    }
    res.status(204).end();
  });

  return router;
}

function parseBatch(body: unknown): { label: string; landmarks: LandmarkSample["landmarks"] }[] | null {
  const raw = body && typeof body === "object" && "samples" in body ? (body as { samples: unknown }).samples : null;
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_BATCH) return null;
  const batch = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const label = typeof (item as { label?: unknown }).label === "string" ? (item as { label: string }).label.trim() : "";
    if (!label || label.length > MAX_LABEL) return null;
    const landmarks = parseLandmarks((item as { landmarks?: unknown }).landmarks);
    if (!landmarks) return null;
    batch.push({ label, landmarks });
  }
  return batch;
}

function parseLandmarks(value: unknown): LandmarkSample["landmarks"] | null {
  if (!Array.isArray(value) || value.length !== 21) return null;
  const points = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const point = item as { x?: unknown; y?: unknown; z?: unknown };
    const x = Number(point.x);
    const y = Number(point.y);
    const z = Number(point.z ?? 0);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null;
    points.push({ x, y, z });
  }
  return points;
}

function toCsv(rows: LandmarkSample[]): string {
  const headers = ["id", "label", "created_at"];
  for (let i = 0; i < 21; i++) headers.push(`x${i}`, `y${i}`, `z${i}`);
  const lines = [headers.join(",")];
  for (const row of rows) {
    const cells = [row.id, csvCell(row.label), row.createdAt];
    for (let i = 0; i < 21; i++) {
      const point = row.landmarks[i] ?? { x: "", y: "", z: "" };
      cells.push(String(point.x), String(point.y), String(point.z));
    }
    lines.push(cells.join(","));
  }
  return `${lines.join("\n")}\n`;
}

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replaceAll("\"", "\"\"")}"`;
  return value;
}
