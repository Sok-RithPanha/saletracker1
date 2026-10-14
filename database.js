import pg from "pg";

const { Pool } = pg;
export const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });

let recordsTableReady;

export function ensureRecordsTable() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured.");
  }

  if (!recordsTableReady) {
    recordsTableReady = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS records (
          id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          type       TEXT NOT NULL CHECK (type IN ('sale', 'expense')),
          name       TEXT NOT NULL,
          amount     NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
          date       DATE NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);
      await pool.query("CREATE INDEX IF NOT EXISTS records_date_idx ON records (date DESC)");
    })().catch((error) => {
      recordsTableReady = undefined;
      throw error;
    });
  }

  return recordsTableReady;
}