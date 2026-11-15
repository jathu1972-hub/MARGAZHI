-- MARGAZHI 28th Annual December Music Festival 2026
-- PostgreSQL / Supabase Production Migration Schema

CREATE TABLE IF NOT EXISTS festival_dates (
  id TEXT PRIMARY KEY,
  day_number INTEGER NOT NULL UNIQUE,
  event_date DATE NOT NULL UNIQUE,
  day_name TEXT NOT NULL,
  day_abbr TEXT NOT NULL,
  date_number TEXT NOT NULL,
  month_abbr TEXT NOT NULL,
  month_full TEXT NOT NULL,
  year TEXT NOT NULL,
  title TEXT NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 150 CHECK (capacity >= 1 AND capacity <= 150),
  booking_status TEXT NOT NULL DEFAULT 'open' CHECK (booking_status IN ('open', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS concert_sessions (
  id TEXT PRIMARY KEY,
  festival_date_id TEXT NOT NULL REFERENCES festival_dates(id) ON DELETE CASCADE,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  title TEXT NOT NULL,
  performers JSONB NOT NULL,
  display_order INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  attendee_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  gender TEXT NOT NULL,
  consent_at TIMESTAMPTZ NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'partially_cancelled', 'cancelled'))
);

CREATE TABLE IF NOT EXISTS tickets (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  festival_date_id TEXT NOT NULL REFERENCES festival_dates(id) ON DELETE RESTRICT,
  seat_number INTEGER NOT NULL CHECK (seat_number >= 1 AND seat_number <= 150),
  verification_token_hash TEXT NOT NULL,
  checked_in_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'checked_in', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enforce unique active seat assignment per festival date
CREATE UNIQUE INDEX IF NOT EXISTS idx_tickets_unique_active_seat
  ON tickets (festival_date_id, seat_number)
  WHERE status != 'cancelled';

CREATE INDEX IF NOT EXISTS idx_tickets_booking_id ON tickets (booking_id);
CREATE INDEX IF NOT EXISTS idx_tickets_date_status ON tickets (festival_date_id, status);

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id BIGSERIAL PRIMARY KEY,
  action TEXT NOT NULL,
  target_id TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);
