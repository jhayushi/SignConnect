import { createApp } from "./app.js";
import { databasePath, openDatabase } from "./db/sqlite.js";
import { SqliteSignRepository, SqliteTranscriptRepository } from "./repositories/sqlite.js";

const PORT = Number(process.env.PORT ?? 3001);
const dbPath = databasePath();
const db = openDatabase(dbPath);

const app = createApp({
  signs: new SqliteSignRepository(db),
  transcripts: new SqliteTranscriptRepository(db),
});

app.listen(PORT, () => {
  console.log(`SignConnect API listening on http://localhost:${PORT}`);
  console.log(`SQLite database: ${dbPath}`);
});

process.on("exit", () => {
  if (db.open) db.close();
});
