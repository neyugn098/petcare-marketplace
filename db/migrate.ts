import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import type { Database } from "./client";
export async function migrate(db: Database) {
  const directory = new URL("./migrations/", import.meta.url);
  return db.transaction(async (tx) => {
    await tx.prepare("SELECT pg_advisory_xact_lock(73402116)").run();
    await tx.prepare("CREATE TABLE IF NOT EXISTS petcare_migrations (name TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())").run();
    for (const name of (await readdir(directory)).filter((name) => name.endsWith(".sql")).sort()) {
      const sql = await readFile(new URL(name, directory), "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      const applied = await tx.prepare("SELECT checksum FROM petcare_migrations WHERE name=$1").bind(name).first<{ checksum: string }>();
      if (applied) { if (applied.checksum !== checksum) throw new Error("Migration changed after application: " + name); continue; }
      // The migration file is trusted, version-controlled SQL, never user input.
      for (const statement of sql.split(";").map((s) => s.trim()).filter(Boolean)) await tx.prepare(statement).run();
      await tx.prepare("INSERT INTO petcare_migrations (name,checksum) VALUES ($1,$2)").bind(name, checksum).run();
      console.log("Applied", name);
    }
  });
}
