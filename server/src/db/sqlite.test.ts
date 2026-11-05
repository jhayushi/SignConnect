import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { SEED_SIGNS } from "../data/signs.js";
import { openDatabase } from "./sqlite.js";
import { SqliteSignRepository, SqliteTranscriptRepository } from "../repositories/sqlite.js";

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

// Write a transcript, close the file, and open it again the way a restart would.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "signconnect-"));
const filename = path.join(dir, "signconnect.sqlite");

const first = openDatabase(filename);
const signs = new SqliteSignRepository(first);
const transcripts = new SqliteTranscriptRepository(first);

const listed = await signs.list();
check(listed.length === SEED_SIGNS.length, `expected ${SEED_SIGNS.length} signs, got ${listed.length}`);
check(
  listed.map((sign) => sign.id).join(",") === SEED_SIGNS.map((sign) => sign.id).join(","),
  "sign order does not match the seed",
);
check(listed.every((sign, index) => sign.word === SEED_SIGNS[index].word), "sign words do not match the seed");

const older = await transcripts.create("HELLO");
const newer = await transcripts.create("THANK YOU FRIEND");
check((await transcripts.list()).map((item) => item.id).join(",") === [newer.id, older.id].join(","), "newest transcript should be first");
first.close();

const second = openDatabase(filename);
const signsAgain = await new SqliteSignRepository(second).list();
const transcriptsAgain = new SqliteTranscriptRepository(second);
const saved = await transcriptsAgain.list();
check(signsAgain.length === SEED_SIGNS.length, "signs did not survive reopen");
check(saved.length === 2, `expected 2 transcripts after reopen, got ${saved.length}`);
check(saved[0].id === newer.id && saved[0].text === "THANK YOU FRIEND", "newest transcript changed after reopen");
check(saved[1].text === "HELLO", "older transcript changed after reopen");

check(await transcriptsAgain.delete(older.id), "delete should remove an existing transcript");
check(!(await transcriptsAgain.delete(older.id)), "delete should report a missing transcript");
check((await transcriptsAgain.list()).length === 1, "deleted transcript still listed");
second.close();

const third = openDatabase(filename);
const afterDelete = await new SqliteTranscriptRepository(third).list();
check(afterDelete.length === 1 && afterDelete[0].id === newer.id, "delete did not survive reopen");
third.close();

fs.rmSync(dir, { recursive: true, force: true });
console.log("sqlite repositories ok");
