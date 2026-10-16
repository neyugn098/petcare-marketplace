import type { Database } from "./client";
export const importTables = ["users", "partners", "partner_users", "pets", "vaccinations", "appointments", "medical_records", "products", "audit_logs", "orders", "order_items"] as const;
export async function importJson(db: Database, input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Expected an object containing table arrays");
  const data = input as Record<string, unknown>;
  for (const key of Object.keys(data)) if (!(importTables as readonly string[]).includes(key)) throw new Error("Unknown table: " + key);
  return db.transaction(async (tx) => {
    const counts: Record<string, number> = {};
    // All identifiers come from this allowlist or PostgreSQL's own catalog.
    for (const table of importTables) {
      const existing = await tx.prepare('SELECT 1 FROM "' + table + '" LIMIT 1').first();
      if (existing) throw new Error("Import requires empty destination tables: " + table);
    }
    for (const table of importTables) {
      const rows = data[table] ?? [];
      if (!Array.isArray(rows)) throw new Error("Expected array for " + table);
      const columns = await tx.prepare("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1").bind(table).all<{ column_name: string }>();
      const allowed = new Set(columns.results.map((row) => row.column_name));
      for (const row of rows) {
        if (!row || typeof row !== "object" || Array.isArray(row)) throw new Error("Invalid row in " + table);
        const keys = Object.keys(row);
        if (!keys.length || keys.some((key) => !allowed.has(key))) throw new Error("Unknown or missing columns in " + table);
        const sql = 'INSERT INTO "' + table + '" (' + keys.map((key) => '"' + key + '"').join(',') + ') VALUES (' + keys.map((_, i) => '$' + (i + 1)).join(',') + ')';
        await tx.prepare(sql).bind(...keys.map((key) => row[key])).run();
      }
      counts[table] = rows.length;
    }
    return counts;
  });
}
