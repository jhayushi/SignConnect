import { createApp } from "./app.js";
import { SEED_SIGNS } from "./data/signs.js";
import { InMemorySignRepository, InMemoryTranscriptRepository } from "./repositories/inMemory.js";

const PORT = Number(process.env.PORT ?? 3001);

// Swap these for PostgreSQL-backed repositories when a database is added.
const app = createApp({
  signs: new InMemorySignRepository(SEED_SIGNS),
  transcripts: new InMemoryTranscriptRepository(),
});

app.listen(PORT, () => {
  console.log(`SignConnect API listening on http://localhost:${PORT}`);
});
