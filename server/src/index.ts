import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
import { databasePath, openDatabase } from "./db/sqlite.js";
import { SqliteSignRepository, SqliteTranscriptRepository } from "./repositories/sqlite.js";

const PORT = Number(process.env.PORT ?? 3001);
const HOST = process.env.HOST ?? "0.0.0.0";
const dbPath = databasePath();
const db = openDatabase(dbPath);

// server/src and server/dist are both one level below the server package.
const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const clientDist = path.resolve(serverRoot, "../client/dist");

const app = createApp(
  {
    signs: new SqliteSignRepository(db),
    transcripts: new SqliteTranscriptRepository(db),
  },
  { clientDist },
);

app.listen(PORT, HOST, () => {
  console.log(`SignConnect listening on http://localhost:${PORT}`);
  console.log(`SQLite database: ${dbPath}`);
});

process.on("exit", () => {
  if (db.open) db.close();
});
