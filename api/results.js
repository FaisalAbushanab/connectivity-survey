import { adminEnabled, authorized } from "../lib/auth.js";
import { db } from "../lib/db.js";

// GET /api/results    every response as JSON, for the admin page at /admin
// Uses the same password as /api/export. No WWW-Authenticate header on 401, so the
// admin page shows its own password form instead of the browser's login dialog.
export async function GET(request) {
  if (!adminEnabled()) return Response.json({ error: "disabled" }, { status: 503 });
  if (!authorized(request)) return Response.json({ error: "unauthorized" }, { status: 401 });

  const pool = await db();
  const { rows } = await pool.query(
    `SELECT id, created_at, updated_at, source, recommendation, answers, result, name, company, phone, city, lead_at
     FROM responses ORDER BY created_at DESC LIMIT 5000`,
  );
  return Response.json({ rows }, { headers: { "Cache-Control": "no-store" } });
}
