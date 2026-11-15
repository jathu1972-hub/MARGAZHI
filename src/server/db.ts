import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { FESTIVAL_DATES_SEED, FESTIVAL_INFO } from '../shared/festivalSchedule';
import {
  allocateSeatsForDates,
  formatSeatNumber,
  formatTicketId,
  normalizeIndianPhone,
} from '../shared/seatAllocation';
import type {
  AdminAuditLogRow,
  AdminRegistrationRow,
  AdminSeatCell,
  BookingConfirmationDTO,
  FestivalDateDTO,
  PublicTicketDTO,
  VerificationResultDTO,
} from '../shared/types';
import type { CreateBookingInput } from '../shared/validation';
import {
  createBookingAccessToken,
  generateVerificationTokenPair,
  hashVerificationToken,
} from './security';

export interface DatabaseService {
  db: Database.Database;
  close: () => void;
  getFestivalDates: () => FestivalDateDTO[];
  createBooking: (
    input: CreateBookingInput,
    options?: { onBeforeCommit?: () => void }
  ) => {
    ok: true;
    confirmation: BookingConfirmationDTO;
    duplicateIdempotent: boolean;
  } | {
    ok: false;
    statusCode: number;
    error: string;
    soldOutDateIds?: string[];
  };
  getBookingConfirmation: (bookingId: string, accessToken: string | undefined, isAdmin: boolean) => BookingConfirmationDTO | null;
  getTicketById: (ticketId: string, rawToken: string | undefined, isAdmin: boolean) => PublicTicketDTO | null;
  inspectTicket: (ticketId: string, rawToken: string, isStaffAuthenticated: boolean, referenceDate?: string) => VerificationResultDTO;
  checkInTicket: (ticketId: string, rawToken?: string, requireTokenMatch?: boolean) => VerificationResultDTO;
  getAdminOverview: () => {
    totalBookings: number;
    totalReservations: number;
    totalCheckedIn: number;
    capacityPerDate: number;
    dates: FestivalDateDTO[];
  };
  getAdminRegistrations: (filters?: {
    dateId?: string;
    search?: string;
    checkInStatus?: string;
    registrationDate?: string;
  }) => AdminRegistrationRow[];
  getAdminSeatMap: (dateId: string) => {
    date: FestivalDateDTO;
    seats: AdminSeatCell[];
  } | null;
  cancelTicket: (ticketId: string, reason?: string) => { ok: boolean; error?: string };
  updateDateBookingStatus: (dateId: string, status: 'open' | 'closed') => boolean;
  getAuditLogs: (limit?: number) => AdminAuditLogRow[];
  recordAuditLog: (action: string, targetId: string | null, metadata?: Record<string, unknown>) => void;
}

export function createDatabaseService(dbFilePath?: string): DatabaseService {
  const resolvedPath = dbFilePath ?? path.resolve(process.cwd(), 'data', 'margazhi.db');
  if (resolvedPath !== ':memory:') {
    fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  }

  const db = new Database(resolvedPath);
  db.pragma('foreign_keys = ON');
  if (resolvedPath !== ':memory:') {
    db.pragma('journal_mode = WAL');
  }
  db.pragma('busy_timeout = 5000');

  // Create normalized schema matching PostgreSQL specification
  db.exec(`
    CREATE TABLE IF NOT EXISTS festival_dates (
      id TEXT PRIMARY KEY,
      day_number INTEGER NOT NULL UNIQUE,
      event_date TEXT NOT NULL UNIQUE,
      day_name TEXT NOT NULL,
      day_abbr TEXT NOT NULL,
      date_number TEXT NOT NULL,
      month_abbr TEXT NOT NULL,
      month_full TEXT NOT NULL,
      year TEXT NOT NULL,
      title TEXT NOT NULL,
      capacity INTEGER NOT NULL DEFAULT 150,
      booking_status TEXT NOT NULL DEFAULT 'open' CHECK (booking_status IN ('open', 'closed')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS concert_sessions (
      id TEXT PRIMARY KEY,
      festival_date_id TEXT NOT NULL REFERENCES festival_dates(id) ON DELETE CASCADE,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      title TEXT NOT NULL,
      performers_json TEXT NOT NULL,
      display_order INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      attendee_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      address TEXT NOT NULL,
      gender TEXT NOT NULL,
      consent_at TEXT NOT NULL,
      idempotency_key TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'partially_cancelled', 'cancelled'))
    );

    CREATE TABLE IF NOT EXISTS tickets (
      id TEXT PRIMARY KEY,
      booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
      festival_date_id TEXT NOT NULL REFERENCES festival_dates(id) ON DELETE RESTRICT,
      seat_number INTEGER NOT NULL CHECK (seat_number >= 1 AND seat_number <= 150),
      verification_token_hash TEXT NOT NULL,
      verification_token_enc TEXT,
      checked_in_at TEXT,
      status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'checked_in', 'cancelled')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Enforce unique active seat per festival date (allows cancelled seats to be reallocated)
    CREATE UNIQUE INDEX IF NOT EXISTS idx_tickets_unique_active_seat
      ON tickets (festival_date_id, seat_number)
      WHERE status != 'cancelled';

    CREATE INDEX IF NOT EXISTS idx_tickets_booking_id ON tickets (booking_id);
    CREATE INDEX IF NOT EXISTS idx_tickets_date_status ON tickets (festival_date_id, status);

    CREATE TABLE IF NOT EXISTS admin_audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      target_id TEXT,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      metadata_json TEXT NOT NULL DEFAULT '{}'
    );
  `);

  // Idempotent seed of official 9 dates & concert sessions (preserves existing bookings/status)
  const insertDate = db.prepare(`
    INSERT OR IGNORE INTO festival_dates (
      id, day_number, event_date, day_name, day_abbr, date_number,
      month_abbr, month_full, year, title, capacity, booking_status
    ) VALUES (
      @id, @dayNumber, @eventDate, @dayName, @dayAbbr, @dateNumber,
      @monthAbbr, @monthFull, @year, @title, @capacity, 'open'
    )
  `);

  const insertSession = db.prepare(`
    INSERT OR IGNORE INTO concert_sessions (
      id, festival_date_id, start_time, end_time, title, performers_json, display_order
    ) VALUES (
      @id, @festivalDateId, @startTime, @endTime, @title, @performersJson, @displayOrder
    )
  `);

  const seedTx = db.transaction(() => {
    for (const dateSeed of FESTIVAL_DATES_SEED) {
      insertDate.run({
        id: dateSeed.id,
        dayNumber: dateSeed.dayNumber,
        eventDate: dateSeed.eventDate,
        dayName: dateSeed.dayName,
        dayAbbr: dateSeed.dayAbbr,
        dateNumber: dateSeed.dateNumber,
        monthAbbr: dateSeed.monthAbbr,
        monthFull: dateSeed.monthFull,
        year: dateSeed.year,
        title: dateSeed.title,
        capacity: dateSeed.capacity,
      });

      for (const session of dateSeed.sessions) {
        insertSession.run({
          id: session.id,
          festivalDateId: dateSeed.id,
          startTime: session.startTime,
          endTime: session.endTime,
          title: session.title,
          performersJson: JSON.stringify(session.performers),
          displayOrder: session.displayOrder,
        });
      }
    }
  });
  seedTx();

  // Helper queries
  function getSessionsByDateMap(): Map<string, FestivalDateDTO['sessions']> {
    const rows = db
      .prepare(
        `SELECT id, festival_date_id, start_time, end_time, title, performers_json, display_order
         FROM concert_sessions
         ORDER BY display_order ASC`
      )
      .all() as Array<{
      id: string;
      festival_date_id: string;
      start_time: string;
      end_time: string;
      title: string;
      performers_json: string;
      display_order: number;
    }>;

    const map = new Map<string, FestivalDateDTO['sessions']>();
    for (const row of rows) {
      const list = map.get(row.festival_date_id) ?? [];
      list.push({
        id: row.id,
        festivalDateId: row.festival_date_id,
        startTime: row.start_time,
        endTime: row.end_time,
        title: row.title,
        performers: JSON.parse(row.performers_json) as string[],
        displayOrder: row.display_order,
      });
      map.set(row.festival_date_id, list);
    }
    return map;
  }

  function getFestivalDates(): FestivalDateDTO[] {
    const sessionsMap = getSessionsByDateMap();
    const rows = db
      .prepare(
        `SELECT
           fd.id,
           fd.day_number,
           fd.event_date,
           fd.day_name,
           fd.day_abbr,
           fd.date_number,
           fd.month_abbr,
           fd.month_full,
           fd.year,
           fd.title,
           fd.capacity,
           fd.booking_status,
           COUNT(CASE WHEN t.status != 'cancelled' THEN 1 END) AS booked_count,
           COUNT(CASE WHEN t.status = 'checked_in' THEN 1 END) AS checked_in_count
         FROM festival_dates fd
         LEFT JOIN tickets t ON t.festival_date_id = fd.id
         GROUP BY fd.id
         ORDER BY fd.day_number ASC`
      )
      .all() as Array<{
      id: string;
      day_number: number;
      event_date: string;
      day_name: string;
      day_abbr: string;
      date_number: string;
      month_abbr: string;
      month_full: string;
      year: string;
      title: string;
      capacity: number;
      booking_status: 'open' | 'closed';
      booked_count: number;
      checked_in_count: number;
    }>;

    return rows.map((r) => ({
      id: r.id,
      dayNumber: r.day_number,
      eventDate: r.event_date,
      dayName: r.day_name,
      dayAbbr: r.day_abbr,
      dateNumber: r.date_number,
      monthAbbr: r.month_abbr,
      monthFull: r.month_full,
      year: r.year,
      title: r.title,
      capacity: r.capacity,
      bookingStatus: r.booking_status,
      bookedCount: r.booked_count,
      remainingSeats: Math.max(0, r.capacity - r.booked_count),
      checkedInCount: r.checked_in_count,
      sessions: sessionsMap.get(r.id) ?? [],
    }));
  }

  function buildPublicTicketsForBooking(
    bookingId: string,
    rawTokensByTicketId?: Map<string, string>
  ): PublicTicketDTO[] {
    const sessionsMap = getSessionsByDateMap();
    const rows = db
      .prepare(
        `SELECT
           t.id,
           t.booking_id,
           t.festival_date_id,
           t.seat_number,
           t.status,
           t.checked_in_at,
           t.created_at,
           b.attendee_name,
           fd.event_date,
           fd.day_name,
           fd.day_number,
           fd.title AS date_title
         FROM tickets t
         JOIN bookings b ON b.id = t.booking_id
         JOIN festival_dates fd ON fd.id = t.festival_date_id
         WHERE t.booking_id = ?
         ORDER BY fd.day_number ASC`
      )
      .all(bookingId) as Array<{
      id: string;
      booking_id: string;
      festival_date_id: string;
      seat_number: number;
      status: 'confirmed' | 'checked_in' | 'cancelled';
      checked_in_at: string | null;
      created_at: string;
      attendee_name: string;
      event_date: string;
      day_name: string;
      day_number: number;
      date_title: string;
    }>;

    return rows.map((r) => ({
      id: r.id,
      bookingId: r.booking_id,
      festivalDateId: r.festival_date_id,
      eventDate: r.event_date,
      dayName: r.day_name,
      dayNumber: r.day_number,
      dateTitle: r.date_title,
      sessions: sessionsMap.get(r.festival_date_id) ?? [],
      seatNumber: r.seat_number,
      seatLabel: formatSeatNumber(r.seat_number),
      attendeeName: r.attendee_name,
      venue: FESTIVAL_INFO.venue,
      venueAddress: FESTIVAL_INFO.venueAddress,
      organizer: `${FESTIVAL_INFO.organizer}, ${FESTIVAL_INFO.organizerAddress}`,
      status: r.status,
      checkedInAt: r.checked_in_at,
      createdAt: r.created_at,
      verificationToken: rawTokensByTicketId?.get(r.id),
    }));
  }

  function createBooking(
    input: CreateBookingInput,
    options?: { onBeforeCommit?: () => void }
  ) {
    const normalizedPhone = normalizeIndianPhone(input.phone);
    if (!normalizedPhone) {
      return {
        ok: false as const,
        statusCode: 400,
        error: 'Please enter a valid 10-digit Indian mobile number.',
      };
    }

    const uniqueDateIds = Array.from(new Set(input.dateIds));
    if (uniqueDateIds.length === 0) {
      return {
        ok: false as const,
        statusCode: 400,
        error: 'Please select at least one festival date.',
      };
    }

    const rawTokensByTicketId = new Map<string, string>();
    let strategy: 'common' | 'independent' = 'common';
    let bookingId = '';
    let createdAt = '';
    let duplicateIdempotent = false;

    const runBookingTx = db.transaction(() => {
      // Idempotency check inside serialized transaction
      const existingBooking = db
        .prepare(`SELECT id, attendee_name, created_at FROM bookings WHERE idempotency_key = ?`)
        .get(input.idempotencyKey) as
        | { id: string; attendee_name: string; created_at: string }
        | undefined;

      if (existingBooking) {
        duplicateIdempotent = true;
        bookingId = existingBooking.id;
        createdAt = existingBooking.created_at;
        const existingTokens = db
          .prepare(`SELECT id, verification_token_enc FROM tickets WHERE booking_id = ?`)
          .all(existingBooking.id) as Array<{ id: string; verification_token_enc: string | null }>;
        for (const t of existingTokens) {
          if (t.verification_token_enc) {
            rawTokensByTicketId.set(t.id, t.verification_token_enc);
          }
        }
        return;
      }

      // Validate all requested dates exist and are open
      const placeholders = uniqueDateIds.map(() => '?').join(',');
      const dateRows = db
        .prepare(
          `SELECT id, event_date, capacity, booking_status, day_number
           FROM festival_dates
           WHERE id IN (${placeholders})
           ORDER BY day_number ASC`
        )
        .all(...uniqueDateIds) as Array<{
        id: string;
        event_date: string;
        capacity: number;
        booking_status: 'open' | 'closed';
        day_number: number;
      }>;

      if (dateRows.length !== uniqueDateIds.length) {
        throw Object.assign(new Error('One or more selected festival dates are invalid.'), {
          statusCode: 400,
        });
      }

      const closedDates = dateRows.filter((d) => d.booking_status !== 'open');
      if (closedDates.length > 0) {
        throw Object.assign(new Error('Booking is currently closed for one or more selected dates.'), {
          statusCode: 400,
        });
      }

      // Consistent ordering for lock/read order
      const orderedDateIds = dateRows.map((d) => d.id);
      const capacityByDate = new Map<string, number>();
      const eventDateById = new Map<string, string>();
      for (const d of dateRows) {
        capacityByDate.set(d.id, d.capacity);
        eventDateById.set(d.id, d.event_date);
      }

      // Gather occupied seats for all selected dates
      const occupiedRows = db
        .prepare(
          `SELECT festival_date_id, seat_number
           FROM tickets
           WHERE festival_date_id IN (${placeholders})
             AND status != 'cancelled'`
        )
        .all(...orderedDateIds) as Array<{ festival_date_id: string; seat_number: number }>;

      const occupiedSeatsByDate = new Map<string, Set<number>>();
      for (const dId of orderedDateIds) {
        occupiedSeatsByDate.set(dId, new Set<number>());
      }
      for (const row of occupiedRows) {
        occupiedSeatsByDate.get(row.festival_date_id)!.add(row.seat_number);
      }

      const allocation = allocateSeatsForDates(orderedDateIds, occupiedSeatsByDate, capacityByDate);
      if (!allocation.ok) {
        throw Object.assign(new Error(allocation.message), {
          statusCode: allocation.reason === 'SOLD_OUT' ? 409 : 400,
          soldOutDateIds: allocation.soldOutDateIds,
        });
      }

      strategy = allocation.strategy;
      bookingId = `BK-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
      createdAt = new Date().toISOString();

      db.prepare(
        `INSERT INTO bookings (
          id, attendee_name, phone, address, gender, consent_at, idempotency_key, created_at, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'confirmed')`
      ).run(
        bookingId,
        input.fullName.trim(),
        normalizedPhone,
        input.address.trim(),
        input.gender,
        createdAt,
        input.idempotencyKey,
        createdAt
      );

      // Determine next sequence per date (counting total tickets issued for that date so IDs never collide even after cancellations)
      const countStmt = db.prepare(
        `SELECT COUNT(*) AS total FROM tickets WHERE festival_date_id = ?`
      );
      const insertTicketStmt = db.prepare(
        `INSERT INTO tickets (
          id, booking_id, festival_date_id, seat_number,
          verification_token_hash, verification_token_enc, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'confirmed', ?)`
      );

      for (const assign of allocation.assignments) {
        const eventDate = eventDateById.get(assign.festivalDateId)!;
        const existingCount = (countStmt.get(assign.festivalDateId) as { total: number }).total;
        let seq = existingCount + 1;
        let ticketId = formatTicketId(eventDate, seq);
        // Ensure uniqueness if an unusual gap/collision occurred
        while (db.prepare(`SELECT 1 FROM tickets WHERE id = ?`).get(ticketId)) {
          seq += 1;
          ticketId = formatTicketId(eventDate, seq);
        }

        const { rawToken, tokenHash } = generateVerificationTokenPair();
        rawTokensByTicketId.set(ticketId, rawToken);

        insertTicketStmt.run(
          ticketId,
          bookingId,
          assign.festivalDateId,
          assign.seatNumber,
          tokenHash,
          rawToken,
          createdAt
        );
      }

      if (options?.onBeforeCommit) {
        options.onBeforeCommit();
      }
    });

    try {
      // BEGIN IMMEDIATE acquires a write lock immediately, serializing concurrent bookings
      runBookingTx.immediate();
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message?: string; soldOutDateIds?: string[] };
      return {
        ok: false as const,
        statusCode: e.statusCode ?? 500,
        error: e.message ?? 'Could not complete booking due to a server error.',
        soldOutDateIds: e.soldOutDateIds,
      };
    }

    const tickets = buildPublicTicketsForBooking(bookingId, rawTokensByTicketId);
    const accessToken = createBookingAccessToken(bookingId);

    return {
      ok: true as const,
      duplicateIdempotent,
      confirmation: {
        bookingId,
        accessToken,
        attendeeName: tickets[0]?.attendeeName ?? input.fullName.trim(),
        strategy,
        createdAt,
        tickets,
      },
    };
  }

  function getBookingConfirmation(
    bookingId: string,
    accessToken: string | undefined,
    isAdmin: boolean
  ): BookingConfirmationDTO | null {
    if (!isAdmin) {
      // Verified in caller via verifyBookingAccessToken, or check here cleanly:
      if (!accessToken || accessToken !== createBookingAccessToken(bookingId)) {
        return null;
      }
    }

    const booking = db
      .prepare(`SELECT id, attendee_name, created_at FROM bookings WHERE id = ?`)
      .get(bookingId) as { id: string; attendee_name: string; created_at: string } | undefined;

    if (!booking) return null;

    const tokenRows = db
      .prepare(`SELECT id, verification_token_enc FROM tickets WHERE booking_id = ?`)
      .all(bookingId) as Array<{ id: string; verification_token_enc: string | null }>;
    const rawTokens = new Map<string, string>();
    for (const r of tokenRows) {
      if (r.verification_token_enc) rawTokens.set(r.id, r.verification_token_enc);
    }

    const tickets = buildPublicTicketsForBooking(bookingId, rawTokens);
    const uniqueSeats = new Set(tickets.map((t) => t.seatNumber));
    return {
      bookingId: booking.id,
      accessToken: createBookingAccessToken(booking.id),
      attendeeName: booking.attendee_name,
      strategy: uniqueSeats.size <= 1 ? 'common' : 'independent',
      createdAt: booking.created_at,
      tickets,
    };
  }

  function getTicketById(
    ticketId: string,
    rawToken: string | undefined,
    isAdmin: boolean
  ): PublicTicketDTO | null {
    const row = db
      .prepare(
        `SELECT t.id, t.booking_id, t.verification_token_hash, t.verification_token_enc
         FROM tickets t
         WHERE t.id = ?`
      )
      .get(ticketId) as
      | {
          id: string;
          booking_id: string;
          verification_token_hash: string;
          verification_token_enc: string | null;
        }
      | undefined;

    if (!row) return null;

    if (!isAdmin) {
      if (!rawToken) return null;
      const incomingHash = hashVerificationToken(rawToken);
      const a = Buffer.from(incomingHash);
      const b = Buffer.from(row.verification_token_hash);
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        return null;
      }
    }

    const tokens = new Map<string, string>();
    if (rawToken) {
      tokens.set(row.id, rawToken);
    } else if (isAdmin && row.verification_token_enc) {
      tokens.set(row.id, row.verification_token_enc);
    }

    const allTickets = buildPublicTicketsForBooking(row.booking_id, tokens);
    return allTickets.find((t) => t.id === ticketId) ?? null;
  }

  function inspectTicket(
    ticketId: string,
    rawToken: string,
    isStaffAuthenticated: boolean,
    referenceDate?: string
  ): VerificationResultDTO {
    const row = db
      .prepare(
        `SELECT
           t.id,
           t.seat_number,
           t.status,
           t.checked_in_at,
           t.verification_token_hash,
           b.attendee_name,
           fd.event_date,
           fd.day_name,
           fd.title AS date_title
         FROM tickets t
         JOIN bookings b ON b.id = t.booking_id
         JOIN festival_dates fd ON fd.id = t.festival_date_id
         WHERE t.id = ?`
      )
      .get(ticketId.trim()) as
      | {
          id: string;
          seat_number: number;
          status: 'confirmed' | 'checked_in' | 'cancelled';
          checked_in_at: string | null;
          verification_token_hash: string;
          attendee_name: string;
          event_date: string;
          day_name: string;
          date_title: string;
        }
      | undefined;

    if (!row) {
      return {
        verificationStatus: 'invalid',
        message: 'Ticket not found or verification code is invalid.',
        ticketId: null,
        eventDate: null,
        dayName: null,
        dateTitle: null,
        seatLabel: null,
        checkedInAt: null,
        attendeeName: null,
        isStaffAuthenticated,
      };
    }

    const incomingHash = hashVerificationToken(rawToken.trim());
    const a = Buffer.from(incomingHash);
    const b = Buffer.from(row.verification_token_hash);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return {
        verificationStatus: 'invalid',
        message: 'Ticket verification signature does not match.',
        ticketId: null,
        eventDate: null,
        dayName: null,
        dateTitle: null,
        seatLabel: null,
        checkedInAt: null,
        attendeeName: null,
        isStaffAuthenticated,
      };
    }

    const basePayload = {
      ticketId: row.id,
      eventDate: row.event_date,
      dayName: row.day_name,
      dateTitle: row.date_title,
      seatLabel: formatSeatNumber(row.seat_number),
      checkedInAt: row.checked_in_at,
      attendeeName: isStaffAuthenticated ? row.attendee_name : null,
      isStaffAuthenticated,
    };

    if (row.status === 'cancelled') {
      return {
        ...basePayload,
        verificationStatus: 'cancelled',
        message: 'This ticket reservation has been cancelled.',
      };
    }

    if (row.status === 'checked_in' || row.checked_in_at !== null) {
      return {
        ...basePayload,
        verificationStatus: 'already_checked_in',
        message: 'This ticket has already been checked in.',
      };
    }

    if (referenceDate && referenceDate !== row.event_date) {
      return {
        ...basePayload,
        verificationStatus: 'wrong_event_date',
        message: `Valid ticket, but scheduled for ${row.day_name}, ${row.event_date} rather than ${referenceDate}.`,
      };
    }

    return {
      ...basePayload,
      verificationStatus: 'valid',
      message: 'Valid MARGAZHI ticket ready for admission.',
    };
  }

  function checkInTicket(
    ticketId: string,
    rawToken?: string,
    requireTokenMatch = false
  ): VerificationResultDTO {
    let result!: VerificationResultDTO;

    const tx = db.transaction(() => {
      const row = db
        .prepare(
          `SELECT
             t.id,
             t.seat_number,
             t.status,
             t.checked_in_at,
             t.verification_token_hash,
             b.attendee_name,
             fd.event_date,
             fd.day_name,
             fd.title AS date_title
           FROM tickets t
           JOIN bookings b ON b.id = t.booking_id
           JOIN festival_dates fd ON fd.id = t.festival_date_id
           WHERE t.id = ?`
        )
        .get(ticketId.trim()) as
        | {
            id: string;
            seat_number: number;
            status: 'confirmed' | 'checked_in' | 'cancelled';
            checked_in_at: string | null;
            verification_token_hash: string;
            attendee_name: string;
            event_date: string;
            day_name: string;
            date_title: string;
          }
        | undefined;

      if (!row) {
        result = {
          verificationStatus: 'invalid',
          message: 'Ticket not found.',
          ticketId: null,
          eventDate: null,
          dayName: null,
          dateTitle: null,
          seatLabel: null,
          checkedInAt: null,
          attendeeName: null,
          isStaffAuthenticated: true,
        };
        return;
      }

      if (requireTokenMatch) {
        const incomingHash = hashVerificationToken((rawToken ?? '').trim());
        const a = Buffer.from(incomingHash);
        const b = Buffer.from(row.verification_token_hash);
        if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
          result = {
            verificationStatus: 'invalid',
            message: 'Ticket verification signature does not match.',
            ticketId: null,
            eventDate: null,
            dayName: null,
            dateTitle: null,
            seatLabel: null,
            checkedInAt: null,
            attendeeName: null,
            isStaffAuthenticated: true,
          };
          return;
        }
      }

      if (row.status === 'cancelled') {
        result = {
          verificationStatus: 'cancelled',
          message: 'Cannot check in a cancelled ticket.',
          ticketId: row.id,
          eventDate: row.event_date,
          dayName: row.day_name,
          dateTitle: row.date_title,
          seatLabel: formatSeatNumber(row.seat_number),
          checkedInAt: null,
          attendeeName: row.attendee_name,
          isStaffAuthenticated: true,
        };
        return;
      }

      const nowIso = new Date().toISOString();
      const updateInfo = db
        .prepare(
          `UPDATE tickets
           SET status = 'checked_in', checked_in_at = ?
           WHERE id = ? AND status = 'confirmed' AND checked_in_at IS NULL`
        )
        .run(nowIso, row.id);

      if (updateInfo.changes === 0) {
        result = {
          verificationStatus: 'already_checked_in',
          message: 'Ticket was already checked in.',
          ticketId: row.id,
          eventDate: row.event_date,
          dayName: row.day_name,
          dateTitle: row.date_title,
          seatLabel: formatSeatNumber(row.seat_number),
          checkedInAt: row.checked_in_at,
          attendeeName: row.attendee_name,
          isStaffAuthenticated: true,
        };
        return;
      }

      recordAuditLog('TICKET_CHECKIN', row.id, {
        eventDate: row.event_date,
        seatNumber: row.seat_number,
      });

      result = {
        verificationStatus: 'valid',
        message: 'Check-in confirmed. Welcome to MARGAZHI.',
        ticketId: row.id,
        eventDate: row.event_date,
        dayName: row.day_name,
        dateTitle: row.date_title,
        seatLabel: formatSeatNumber(row.seat_number),
        checkedInAt: nowIso,
        attendeeName: row.attendee_name,
        isStaffAuthenticated: true,
      };
    });

    tx.immediate();
    return result;
  }

  function getAdminOverview() {
    const dates = getFestivalDates();
    const bookingCountRow = db
      .prepare(`SELECT COUNT(*) AS count FROM bookings WHERE status != 'cancelled'`)
      .get() as { count: number };

    const totalReservations = dates.reduce((sum, d) => sum + d.bookedCount, 0);
    const totalCheckedIn = dates.reduce((sum, d) => sum + d.checkedInCount, 0);

    return {
      totalBookings: bookingCountRow.count,
      totalReservations,
      totalCheckedIn,
      capacityPerDate: FESTIVAL_INFO.capacityPerDate,
      dates,
    };
  }

  function getAdminRegistrations(filters?: {
    dateId?: string;
    search?: string;
    checkInStatus?: string;
    registrationDate?: string;
  }): AdminRegistrationRow[] {
    const clauses: string[] = [];
    const params: unknown[] = [];

    if (filters?.dateId && filters.dateId !== 'all') {
      clauses.push('t.festival_date_id = ?');
      params.push(filters.dateId);
    }

    if (filters?.checkInStatus && filters.checkInStatus !== 'all') {
      clauses.push('t.status = ?');
      params.push(filters.checkInStatus);
    }

    if (filters?.registrationDate) {
      clauses.push('substr(t.created_at, 1, 10) = ?');
      params.push(filters.registrationDate);
    }

    if (filters?.search && filters.search.trim().length > 0) {
      const term = `%${filters.search.trim()}%`;
      clauses.push(
        `(b.attendee_name LIKE ? OR b.phone LIKE ? OR t.id LIKE ? OR printf('%03d', t.seat_number) LIKE ?)`
      );
      params.push(term, term, term, term);
    }

    const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = db
      .prepare(
        `SELECT
           t.id AS ticket_id,
           t.booking_id,
           t.seat_number,
           b.attendee_name,
           b.phone,
           b.address,
           b.gender,
           t.festival_date_id,
           fd.event_date,
           fd.day_name,
           t.status AS ticket_status,
           t.checked_in_at,
           t.created_at
         FROM tickets t
         JOIN bookings b ON b.id = t.booking_id
         JOIN festival_dates fd ON fd.id = t.festival_date_id
         ${whereSql}
         ORDER BY fd.day_number ASC, t.seat_number ASC, t.created_at DESC`
      )
      .all(...params) as Array<{
      ticket_id: string;
      booking_id: string;
      seat_number: number;
      attendee_name: string;
      phone: string;
      address: string;
      gender: string;
      festival_date_id: string;
      event_date: string;
      day_name: string;
      ticket_status: 'confirmed' | 'checked_in' | 'cancelled';
      checked_in_at: string | null;
      created_at: string;
    }>;

    return rows.map((r) => ({
      ticketId: r.ticket_id,
      bookingId: r.booking_id,
      seatNumber: r.seat_number,
      seatLabel: formatSeatNumber(r.seat_number),
      fullName: r.attendee_name,
      phone: r.phone,
      address: r.address,
      gender: r.gender,
      festivalDateId: r.festival_date_id,
      eventDate: r.event_date,
      dayName: r.day_name,
      ticketStatus: r.ticket_status,
      checkedInAt: r.checked_in_at,
      createdAt: r.created_at,
    }));
  }

  function getAdminSeatMap(dateId: string) {
    const dates = getFestivalDates();
    const date = dates.find((d) => d.id === dateId);
    if (!date) return null;

    const regs = getAdminRegistrations({ dateId }).filter(
      (r) => r.ticketStatus !== 'cancelled'
    );
    const bySeat = new Map<number, AdminRegistrationRow>();
    for (const r of regs) {
      bySeat.set(r.seatNumber, r);
    }

    const seats: AdminSeatCell[] = [];
    for (let s = 1; s <= date.capacity; s++) {
      const reg = bySeat.get(s) ?? null;
      let status: AdminSeatCell['status'] = 'available';
      if (reg) {
        status = reg.ticketStatus === 'checked_in' ? 'checked_in' : 'booked';
      }
      seats.push({
        seatNumber: s,
        seatLabel: formatSeatNumber(s),
        status,
        registration: reg,
      });
    }

    return { date, seats };
  }

  function cancelTicket(ticketId: string, reason?: string) {
    let response: { ok: boolean; error?: string } = { ok: false, error: 'Ticket not found.' };

    const tx = db.transaction(() => {
      const ticket = db
        .prepare(
          `SELECT id, booking_id, festival_date_id, seat_number, status
           FROM tickets WHERE id = ?`
        )
        .get(ticketId) as
        | {
            id: string;
            booking_id: string;
            festival_date_id: string;
            seat_number: number;
            status: string;
          }
        | undefined;

      if (!ticket) {
        response = { ok: false, error: 'Ticket not found.' };
        return;
      }

      if (ticket.status === 'cancelled') {
        response = { ok: false, error: 'Ticket is already cancelled.' };
        return;
      }

      db.prepare(`UPDATE tickets SET status = 'cancelled' WHERE id = ?`).run(ticket.id);

      const remainingActive = db
        .prepare(
          `SELECT COUNT(*) AS count FROM tickets WHERE booking_id = ? AND status != 'cancelled'`
        )
        .get(ticket.booking_id) as { count: number };

      const newBookingStatus =
        remainingActive.count === 0 ? 'cancelled' : 'partially_cancelled';
      db.prepare(`UPDATE bookings SET status = ? WHERE id = ?`).run(
        newBookingStatus,
        ticket.booking_id
      );

      recordAuditLog('TICKET_CANCEL', ticket.id, {
        bookingId: ticket.booking_id,
        festivalDateId: ticket.festival_date_id,
        seatNumber: ticket.seat_number,
        reason: reason ?? 'Cancelled by administrator',
      });

      response = { ok: true };
    });

    tx.immediate();
    return response;
  }

  function updateDateBookingStatus(dateId: string, status: 'open' | 'closed'): boolean {
    const res = db
      .prepare(`UPDATE festival_dates SET booking_status = ? WHERE id = ?`)
      .run(status, dateId);
    if (res.changes > 0) {
      recordAuditLog('DATE_STATUS_CHANGE', dateId, { bookingStatus: status });
      return true;
    }
    return false;
  }

  function recordAuditLog(
    action: string,
    targetId: string | null,
    metadata: Record<string, unknown> = {}
  ) {
    db.prepare(
      `INSERT INTO admin_audit_logs (action, target_id, timestamp, metadata_json)
       VALUES (?, ?, ?, ?)`
    ).run(action, targetId, new Date().toISOString(), JSON.stringify(metadata));
  }

  function getAuditLogs(limit = 50): AdminAuditLogRow[] {
    const rows = db
      .prepare(
        `SELECT id, action, target_id, timestamp, metadata_json
         FROM admin_audit_logs
         ORDER BY id DESC
         LIMIT ?`
      )
      .all(limit) as Array<{
      id: number;
      action: string;
      target_id: string | null;
      timestamp: string;
      metadata_json: string;
    }>;

    return rows.map((r) => ({
      id: r.id,
      action: r.action,
      targetId: r.target_id,
      timestamp: r.timestamp,
      metadata: JSON.parse(r.metadata_json) as Record<string, unknown>,
    }));
  }

  return {
    db,
    close: () => db.close(),
    getFestivalDates,
    createBooking,
    getBookingConfirmation,
    getTicketById,
    inspectTicket,
    checkInTicket,
    getAdminOverview,
    getAdminRegistrations,
    getAdminSeatMap,
    cancelTicket,
    updateDateBookingStatus,
    getAuditLogs,
    recordAuditLog,
  };
}
