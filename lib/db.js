import pg from "pg";
import { attachDatabasePool } from "@vercel/functions";

// DATABASE_URL is set by the Neon integration; POSTGRES_URL by older Vercel Postgres projects.
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
  max: 5,
});
attachDatabasePool(pool);

// Created on first use so a fresh database needs no migration step.
// One row per run through the survey; contact columns fill in when the visitor asks for a site check.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS responses (
  id             uuid PRIMARY KEY,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  source         text NOT NULL,
  recommendation text NOT NULL,
  answers        jsonb NOT NULL,
  result         jsonb NOT NULL,
  assumptions    jsonb,
  name           text,
  company        text,
  phone          text,
  city           text,
  lead_at        timestamptz
)`;

let ready;
export function db() {
  ready ??= pool.query(SCHEMA).catch((err) => {
    ready = null;
    throw err;
  });
  return ready.then(() => pool);
}
