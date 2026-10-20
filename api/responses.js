import { db } from "../lib/db.js";

const OPTIONS = ["wifi", "cable", "op", "p5g"];
const NUM_ANSWERS = ["area", "yard", "cams", "fixed", "mobile", "growth", "hours", "hourcost"];
const BOOL_ANSWERS = ["req_auto", "req_critical", "req_local"];
const ENUM_ANSWERS = { metal: ["light", "heavy"], signal: ["good", "weak", "none"] };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SOURCE = /^(default|custom|example:[a-z]{1,20})$/;
const MAX_BODY = 16_000;

const obj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const text = (v) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 200) : null);
const bad = (error, status = 400) => Response.json({ error }, { status });

// Keep only the fields the survey sends, so the endpoint cannot be used to store arbitrary data.
function clean(body) {
  if (!UUID.test(body.id) || !SOURCE.test(body.source)) return null;

  const a = obj(body.answers), answers = {};
  NUM_ANSWERS.forEach((k) => (answers[k] = num(a[k])));
  BOOL_ANSWERS.forEach((k) => (answers[k] = a[k] === true));
  Object.entries(ENUM_ANSWERS).forEach(([k, allowed]) => (answers[k] = allowed.includes(a[k]) ? a[k] : null));

  const r = obj(body.result), options = {};
  if (!OPTIONS.includes(r.best)) return null;
  OPTIONS.forEach((k) => {
    const o = obj(obj(r.options)[k]);
    options[k] = { up: num(o.up), run: num(o.run), save: num(o.save), pay: num(o.pay), net5: num(o.net5), ok: o.ok === true };
  });
  const result = { best: r.best, devices: num(r.devices), cams: num(r.cams), radios: num(r.radios), options };

  const assumptions = Object.fromEntries(
    Object.entries(obj(body.assumptions))
      .filter(([k, v]) => /^[a-zA-Z0-9]{1,20}$/.test(k) && num(v) !== null)
      .slice(0, 40),
  );

  let contact = null;
  if (body.contact) {
    const c = obj(body.contact);
    contact = { name: text(c.name), company: text(c.company), phone: text(c.phone), city: text(c.city) };
    if (!contact.name || !contact.company || !contact.phone) return null;
  }

  return {
    id: body.id.toLowerCase(),
    source: body.source,
    answers,
    result,
    assumptions: Object.keys(assumptions).length ? assumptions : null,
    contact,
  };
}

export async function POST(request) {
  const raw = await request.text();
  if (raw.length > MAX_BODY) return bad("Body too large", 413);
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return bad("Invalid JSON");
  }
  const r = clean(obj(body));
  if (!r) return bad("Invalid response");

  const c = r.contact || {};
  const pool = await db();
  await pool.query(
    `INSERT INTO responses (id, source, recommendation, answers, result, assumptions, name, company, phone, city, lead_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CASE WHEN $7::text IS NULL THEN NULL ELSE now() END)
     ON CONFLICT (id) DO UPDATE SET
       updated_at = now(),
       source = EXCLUDED.source,
       recommendation = EXCLUDED.recommendation,
       answers = EXCLUDED.answers,
       result = EXCLUDED.result,
       assumptions = EXCLUDED.assumptions,
       name = COALESCE(EXCLUDED.name, responses.name),
       company = COALESCE(EXCLUDED.company, responses.company),
       phone = COALESCE(EXCLUDED.phone, responses.phone),
       city = COALESCE(EXCLUDED.city, responses.city),
       lead_at = COALESCE(responses.lead_at, EXCLUDED.lead_at)`,
    [r.id, r.source, r.result.best, r.answers, r.result, r.assumptions, c.name, c.company, c.phone, c.city],
  );
  return Response.json({ ok: true });
}
