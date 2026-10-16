import { Pool, type PoolClient } from "pg";

export type QueryResult = { rows: Record<string, unknown>[]; rowCount: number | null };
export type Executor = (sql: string, values: unknown[]) => Promise<QueryResult>;
export type Result<T = Record<string, unknown>> = { results: T[]; meta: { changes: number } };

export class Statement {
  constructor(readonly db: Database, readonly sql: string, readonly values: unknown[] = []) {}
  bind(...values: unknown[]) { return new Statement(this.db, this.sql, values); }
  async all<T = Record<string, unknown>>(): Promise<Result<T>> {
    const result = await this.db.execute(this.sql, this.values);
    return { results: result.rows as T[], meta: { changes: result.rowCount ?? 0 } };
  }
  async first<T = Record<string, unknown>>(): Promise<T | null> { return (await this.all<T>()).results[0] ?? null; }
  async run() { return this.all(); }
}

// Keeps business queries small, while all SQL uses native PostgreSQL placeholders.
export class Database {
  constructor(readonly execute: Executor, private readonly begin: <T>(fn: (db: Database) => Promise<T>) => Promise<T>) {}
  prepare(sql: string) { return new Statement(this, sql); }
  transaction<T>(fn: (db: Database) => Promise<T>): Promise<T> { return this.begin(fn); }
  batch(statements: Statement[]) {
    return this.transaction(async (tx) => {
      const results = [];
      for (const statement of statements) results.push(await tx.prepare(statement.sql).bind(...statement.values).run());
      return results;
    });
  }
}

const state = globalThis as typeof globalThis & { petcarePool?: Pool; petcareDatabase?: Database };
export function getPool() {
  if (!state.petcarePool) {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required. Copy .env.example to .env and run db:migrate.");
    const max = Number(process.env.DATABASE_POOL_MAX || 10);
    if (!Number.isInteger(max) || max < 1 || max > 100) throw new Error("DATABASE_POOL_MAX must be 1..100");
    let connectionString = process.env.DATABASE_URL;
    const ca = process.env.DATABASE_SSL_CA?.replace(/\\n/g, "\n");
    if (ca) {
      // pg parses URL SSL options after the explicit config; remove them so
      // the supplied CA and mandatory certificate verification remain active.
      const url = new URL(connectionString);
      for (const key of ["sslmode", "sslrootcert", "sslcert", "sslkey", "ssl", "uselibpqcompat"]) url.searchParams.delete(key);
      connectionString = url.toString();
    }
    state.petcarePool = new Pool({ connectionString, max, connectionTimeoutMillis: 10000, idleTimeoutMillis: 30000,
      ...(ca ? { ssl: { ca, rejectUnauthorized: true } } : {}),
    });
    state.petcarePool.on("error", (error) => console.error("postgres_pool_error", error.message));
  }
  return state.petcarePool;
}
function transactionDatabase(client: PoolClient): Database {
  const db: Database = new Database((sql, values) => client.query(sql, values), async (fn) => fn(db));
  return db;
}
export function getDatabase(): Database {
  if (!state.petcareDatabase) {
    state.petcareDatabase = new Database((sql, values) => getPool().query(sql, values), async (fn) => {
      const client = await getPool().connect();
      try {
        await client.query("BEGIN");
        const result = await fn(transactionDatabase(client));
        await client.query("COMMIT");
        return result;
      } catch (error) { await client.query("ROLLBACK"); throw error; }
      finally { client.release(); }
    });
  }
  return state.petcareDatabase;
}
export async function closeDatabase() { await state.petcarePool?.end(); delete state.petcarePool; delete state.petcareDatabase; }
