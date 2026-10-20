import { createHash, timingSafeEqual } from "node:crypto";
import { db } from "../lib/db.js";

const OPTIONS = { wifi: "wifi", cable: "cabling", op: "operator_5g", p5g: "private_5g" };
const ANSWERS = ["area", "yard", "metal", "signal", "cams", "fixed", "mobile", "growth", "req_auto", "req_critical", "req_local", "hours", "hourcost"];

// [CSV header, value from a database row]
const COLUMNS = [
  ["created_at", (r) => r.created_at.toISOString()],
  ["updated_at", (r) => r.updated_at.toISOString()],
  ["source", (r) => r.source],
  ["recommendation", (r) => OPTIONS[r.recommendation] ?? r.recommendation],
  ["name", (r) => r.name],
  ["company", (r) => r.company],
  ["phone", (r) => r.phone],
  ["city", (r) => r.city],
  ["lead_at", (r) => r.lead_at?.toISOString()],
  ...ANSWERS.map((k) => [k, (r) => r.answers[k]]),
  ["devices_after_growth", (r) => r.result.devices],
  ["cameras_after_growth", (r) => r.result.cams],
  ["private_5g_radio_units", (r) => r.result.radios],
  ...Object.entries(OPTIONS).flatMap(([k, label]) => [
    [`${label}_upfront_sar`, (r) => r.result.options[k]?.up],
    [`${label}_running_sar_per_yr`, (r) => r.result.options[k]?.run],
    [`${label}_savings_sar_per_yr`, (r) => r.result.options[k]?.save],
    [`${label}_payback_months`, (r) => r.result.options[k]?.pay],
    [`${label}_gain_5yr_sar`, (r) => r.result.options[k]?.net5],
    [`${label}_suitable`, (r) => r.result.options[k]?.ok],
  ]),
  ["custom_assumptions", (r) => (r.assumptions ? JSON.stringify(r.assumptions) : null)],
  ["id", (r) => r.id],
];

function cell(v) {
  if (v == null) return "";
  let s = String(v);
  // Stop spreadsheet apps from treating visitor text as a formula; plain numbers and phone numbers pass through.
  if (/^[=@\t\r]/.test(s) || (/^[+-]/.test(s) && !/^[+-]?[\d\s().-]+$/.test(s))) s = "'" + s;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function authorized(request) {
  const header = request.headers.get("authorization") || "";
  if (!header.startsWith("Basic ")) return false;
  const decoded = Buffer.from(header.slice(6), "base64").toString();
  const password = decoded.slice(decoded.indexOf(":") + 1);
  const hash = (s) => createHash("sha256").update(s).digest();
  return timingSafeEqual(hash(password), hash(process.env.EXPORT_PASSWORD));
}

// GET /api/export          every response
// GET /api/export?leads    only responses with contact details
export async function GET(request) {
  if (!process.env.EXPORT_PASSWORD) {
    return new Response("Export is disabled. Set EXPORT_PASSWORD in the Vercel project settings.", { status: 503 });
  }
  if (!authorized(request)) {
    return new Response("Password required", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="Survey export", charset="UTF-8"' },
    });
  }

  const leadsOnly = new URL(request.url).searchParams.has("leads");
  const pool = await db();
  const { rows } = await pool.query(
    `SELECT * FROM responses ${leadsOnly ? "WHERE lead_at IS NOT NULL" : ""} ORDER BY created_at DESC`,
  );
  const lines = [COLUMNS.map(([h]) => h), ...rows.map((r) => COLUMNS.map(([, get]) => get(r)))];
  const csv = lines.map((line) => line.map(cell).join(",")).join("\r\n");
  const day = new Date().toISOString().slice(0, 10);

  // The byte order mark makes Excel read Arabic names correctly.
  return new Response("﻿" + csv + "\r\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="survey-${leadsOnly ? "leads" : "responses"}-${day}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
