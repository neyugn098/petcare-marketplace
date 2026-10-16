import "dotenv/config";
import { readFile } from "node:fs/promises";
import { getDatabase, closeDatabase } from "../db/client";
import { importJson } from "../db/import-json";
const file = process.argv[2];
if (!file) throw new Error("Usage: pnpm db:import-json path/to/export.json");
try { console.log(await importJson(getDatabase(), JSON.parse(await readFile(file, "utf8")))); } finally { await closeDatabase(); }
