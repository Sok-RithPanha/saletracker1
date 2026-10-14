import { ensureRecordsTable, pool } from "../lib/database.js";

const SELECT = "id, type, name, amount::float8 AS amount, to_char(date, 'YYYY-MM-DD') AS date";

export default async function records(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).end();
  }

  try {
    await ensureRecordsTable();

    if (req.method === "GET") {
      const { rows } = await pool.query(
        `SELECT ${SELECT} FROM records ORDER BY date DESC, created_at DESC`
      );
      return res.status(200).json(rows);
    }

    const { type, name, amount, date } = req.body ?? {};
    const value = Number(amount);
    if (!["sale", "expense"].includes(type)) return res.status(400).json({ error: "Invalid type." });
    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "Name is required." });
    }
    if (!Number.isFinite(value) || value <= 0) {
      return res.status(400).json({ error: "Amount must be greater than 0." });
    }
    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: "Date must be YYYY-MM-DD." });
    }

    const { rows } = await pool.query(
      `INSERT INTO records (type, name, amount, date) VALUES ($1, $2, $3, $4) RETURNING ${SELECT}`,
      [type, name.trim(), value, date]
    );
    return res.status(201).json(rows[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Could not process records. Check the Vercel DATABASE_URL setting." });
  }
}