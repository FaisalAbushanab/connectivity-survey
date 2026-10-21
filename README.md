# Factory Connectivity Advisor

The MOBISENSE connectivity survey, served at https://survey.mobisense.ai on Vercel. Answers are stored in Postgres.

```
public/index.html     the survey (static, no build step)
public/index_old.html the previous survey with its older cost assumptions, kept for reference
api/responses.js      POST: saves one row per run through the survey
api/export.js         GET: downloads every row as CSV (password protected)
lib/db.js             Postgres pool; creates the table on first use
```

## What gets stored

One row in `responses` per visitor run. The row is written when the visitor reaches the result screen, updated if they go back and change answers, and the contact columns fill in if they request a site check. "Start again" begins a new row.

| column | meaning |
| --- | --- |
| `source` | `default` (starting values, untouched), `example:small` / `mid` / `large`, or `custom` |
| `recommendation` | `wifi`, `cable`, `op` or `p5g` |
| `answers` | everything entered on the first three steps (jsonb) |
| `result` | cost, savings, payback and suitability for all four options (jsonb) |
| `assumptions` | only the cost assumptions the visitor changed, otherwise null |
| `name`, `company`, `phone`, `city`, `lead_at` | set when the site check form is submitted |

## Deploy

1. **Create the project**: `vercel` from this folder (or push to GitHub and import it in the Vercel dashboard).
2. **Add the database**: Vercel dashboard → project → Storage → Create Database → Neon (free tier). Pick the **Frankfurt (eu-central-1)** region to match `regions: ["fra1"]` in `vercel.json`. Connecting it sets `DATABASE_URL`. The table is created automatically on the first request.
3. **Set an export password**: `vercel env add EXPORT_PASSWORD production`
4. **Deploy**: `vercel --prod`
5. **Add the domain**: project → Settings → Domains → add `survey.mobisense.ai`. mobisense.ai's DNS is on Cloudflare, so add the records Vercel shows there: a `TXT` on `_vercel` to verify ownership, and a `CNAME` for `survey`. Set the CNAME's proxy status to **DNS only** (grey cloud) so Vercel can issue the HTTPS certificate.

## Getting the data out

- **CSV**: open https://survey.mobisense.ai/api/export. The browser asks for a username and password: any username, plus the `EXPORT_PASSWORD`. Add `?leads` for only rows with contact details. The file opens in Excel with Arabic text intact. A blank `*_payback_months` means it does not pay back within 5 years.
- **SQL**: Neon console → SQL Editor, or `psql "$DATABASE_URL"`:

  ```sql
  SELECT created_at, name, company, phone, answers->>'area' AS area, recommendation
  FROM responses WHERE lead_at IS NOT NULL ORDER BY created_at DESC;
  ```

## Local development

```
vercel link && vercel env pull .env.local && vercel dev
```
# connectivity-survey
# connectivity-survey
