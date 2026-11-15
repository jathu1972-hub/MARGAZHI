# MARGAZHI — Setup & Deployment Guide

## Environment Variables

Configure the following environment variables in `.env` (local) and in your hosting dashboard (Netlify / Cloud):

- `ADMIN_PASSWORD` — Password for `/admin` dashboard and `/verify` staff check-in.
- `SESSION_SECRET` — Long random string (32+ characters) used to sign HTTP-only session cookies and booking access tokens.
- `DATABASE_URL` — PostgreSQL connection string (e.g., Supabase) for production PostgreSQL deployments. In local AI Studio / Node development without `DATABASE_URL`, the application automatically uses an ACID-transactional SQLite database stored at `./data/margazhi.db`.

## Local Development & Verification

```bash
npm install
npm run dev
```

Run the automated test suite covering all 12 scenarios (Tests A–L):

```bash
npm test
```

## Database Migrations

For PostgreSQL / Supabase deployment, apply `db/migrations/001_initial_postgres.sql` to create:
- `festival_dates`
- `concert_sessions`
- `bookings`
- `tickets` (with `idx_tickets_unique_active_seat` enforcing unique active seats per date)
- `admin_audit_logs`

## Netlify Production Notes

1. Connect the GitHub repository to Netlify (`https://margazhievent.netlify.app/`).
2. Set `DATABASE_URL`, `ADMIN_PASSWORD`, and `SESSION_SECRET` in Netlify Site Settings -> Environment Variables.
3. Ensure the `server.ts` Express API routes are hosted via a persistent Node service or Netlify Functions adapter connected to your managed PostgreSQL instance so `BEGIN` / `SELECT ... FOR UPDATE` transactions remain atomic across concurrent requests.
