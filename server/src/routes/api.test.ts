import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { createApp } from "../app.js";
import { SEED_SIGNS } from "../data/signs.js";
import { openDatabase } from "../db/sqlite.js";
import { SqliteSignRepository, SqliteTranscriptRepository } from "../repositories/sqlite.js";

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const db = openDatabase(":memory:");
const app = createApp({
  signs: new SqliteSignRepository(db),
  transcripts: new SqliteTranscriptRepository(db),
});
const server = createServer(app);
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
const port = (server.address() as AddressInfo).port;

async function call(path: string, init?: RequestInit): Promise<{ status: number; body: unknown }> {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

const health = await call("/api/health");
check(health.status === 200 && (health.body as { ok: boolean }).ok, "health check failed");

const signs = await call("/api/signs");
const signList = signs.body as { id: string; word: string; description: string }[];
check(signs.status === 200, "signs status");
check(signList.length === SEED_SIGNS.length && signList.length >= 40, `expected at least 40 signs, got ${signList.length}`);
check(signList.some((sign) => sign.word === "HELLO" && sign.description.length > 0), "HELLO missing from API");
check(signList.some((sign) => sign.word === "A"), "letter A missing from API");
check(signList.some((sign) => sign.word === "WHERE"), "WHERE missing from API");

const created = await call("/api/transcripts", { method: "POST", body: JSON.stringify({ text: "HELLO A 3" }) });
const saved = created.body as { id: string; text: string; createdAt: string };
check(created.status === 201 && saved.text === "HELLO A 3" && saved.id, "create transcript failed");

const listed = await call("/api/transcripts");
const rows = listed.body as { id: string; text: string }[];
check(listed.status === 200 && rows.length === 1 && rows[0].id === saved.id, "list transcripts failed");

const viewed = await call(`/api/transcripts/${saved.id}`);
check(viewed.status === 200 && (viewed.body as { text: string }).text === "HELLO A 3", "view transcript failed");

const empty = await call("/api/transcripts", { method: "POST", body: JSON.stringify({ text: "   " }) });
check(empty.status === 400, "blank transcript should be rejected");

const tooLong = await call("/api/transcripts", {
  method: "POST",
  body: JSON.stringify({ text: "A".repeat(1001) }),
});
check(tooLong.status === 400, "long transcript should be rejected");

const removed = await call(`/api/transcripts/${saved.id}`, { method: "DELETE" });
check(removed.status === 204, "delete should return 204");
const missing = await call(`/api/transcripts/${saved.id}`);
check(missing.status === 404, "deleted transcript should be gone");
const missingDelete = await call(`/api/transcripts/${saved.id}`, { method: "DELETE" });
check(missingDelete.status === 404, "deleting a missing transcript should be 404");

const after = await call("/api/transcripts");
check(Array.isArray(after.body) && (after.body as unknown[]).length === 0, "transcript list should be empty");

server.close();
db.close();
console.log(`api routes ok (${signList.length} signs)`);
