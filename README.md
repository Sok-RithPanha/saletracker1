# Ledger – Sales & Expense Tracker

React + Tailwind CSS on the front end, an Express API, and Neon (serverless Postgres) for storage.

```
Browser (React)  →  /api/records  →  Express server  →  Neon Postgres
```

The browser never talks to Neon directly, so your database password stays on the server.

## 1. Create the Neon database
1. Sign in at https://console.neon.tech and create a project.
2. Click **Connect** on the project dashboard and copy the connection string.

## 2. Run it locally
Requires Node 20.6 or newer.

```bash
cp .env.example .env     # paste your Neon connection string as DATABASE_URL
npm install
npm run dev              # API on :3001, app on http://localhost:5173
```

The server creates the `records` table on first start, so there is no manual SQL step.

## 3. Production
```bash
npm run build            # builds the React app into dist/
npm start                # Express serves the API and the built app together
```
Deploy to any Node host (Render, Railway, Fly.io) and set `DATABASE_URL` as an environment variable.

## API
| Method | Path | Purpose |
| --- | --- | --- |
| GET | /api/records | List all records |
| POST | /api/records | Add `{ type, name, amount, date }` |
| DELETE | /api/records/:id | Remove a record |

## Table
```sql
records (id uuid, type 'sale' | 'expense', name text, amount numeric(12,2), date date, created_at timestamptz)
```

## Before sharing the app
There is no login, so anyone who can reach the server can read and change the data. Add authentication
before exposing it publicly.
