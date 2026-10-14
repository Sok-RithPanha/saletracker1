import { ensureRecordsTable, pool } from "../../lib/database.js";

export default async function record(req, res) {
  if (req.method !== "DELETE") {
    res.setHeader("Allow", "DELETE");
    return res.status(405).end();
  }

  try {
    await ensureRecordsTable();
    await pool.query("DELETE FROM records WHERE id = $1", [req.query.id]);
    return res.status(204).end();
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Could not delete the record. Check the Vercel DATABASE_URL setting." });
  }
}