import "dotenv/config";
import { getDatabase, closeDatabase } from "../db/client";
import { migrate } from "../db/migrate";
try { await migrate(getDatabase()); } finally { await closeDatabase(); }
