import express from "express";
import pg from "pg";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const { DATABASE_URL, PORT = 3001 } = process.env;
if (!DATABASE_URL) {
  console.error("Missing DATABASE_URL. Copy .env.example to .env and paste your Neon connection string.");
  process.exit(1);
}

// Neon requires TLS; the connection string from the Neon dashboard already includes sslmode=require.
const pool = new pg.Pool({ connectionString: DATABASE_URL });

await pool.query(`
  CREATE TABLE IF NOT EXISTS records (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type       TEXT NOT NULL CHECK (type IN ('sale', 'expense')),
    name       TEXT NOT NULL,
    amount     NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    date       DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS records_date_idx ON records (date DESC);
`);

const app = express();
app.use(express.json());

const SELECT = `id, type, name, amount::float8 AS amount, to_char(date, 'YYYY-MM-DD') AS date`;

app.get("/api/records", async (_req, res) => {
  try {
    const { rows } = await pool.query(`SELECT ${SELECT} FROM records ORDER BY date DESC, created_at DESC`);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Could not load records." });
  }
});

app.post("/api/records", async (req, res) => {
  const { type, name, amount, date } = req.body ?? {};
  const value = Number(amount);
  if (!["sale", "expense"].includes(type)) return res.status(400).json({ error: "Invalid type." });
  if (typeof name !== "string" || !name.trim()) return res.status(400).json({ error: "Name is required." });
  if (!Number.isFinite(value) || value <= 0) return res.status(400).json({ error: "Amount must be greater than 0." });
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: "Date must be YYYY-MM-DD." });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO records (type, name, amount, date) VALUES ($1, $2, $3, $4) RETURNING ${SELECT}`,
      [type, name.trim(), value, date]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Could not save the record." });
  }
});

app.delete("/api/records/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM records WHERE id = $1", [req.params.id]);
    res.status(204).end();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Could not delete the record." });
  }
});

// In production, serve the built React app from the same server.
const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get("*", (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
