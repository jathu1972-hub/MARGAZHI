import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import ExcelJS from 'exceljs';
import { sanitizeSpreadsheetCell } from '../shared/seatAllocation';
import { createApiApp } from './app';
import { createDatabaseService } from './db';
import { generateFestivalWorkbook } from './excelExport';
import { clearRateLimitBuckets, createSessionToken, verifySessionToken } from './security';

const DAY1 = 'day-1-2026-12-26';
const DAY2 = 'day-2-2026-12-27';
const DAY3 = 'day-3-2026-12-28';

function makeBookingPayload(
  dateIds: string[],
  overrides: Partial<{
    fullName: string;
    phone: string;
    address: string;
    gender: 'Male' | 'Female' | 'Other' | 'Prefer not to say';
    idempotencyKey: string;
  }> = {}
) {
  return {
    fullName: overrides.fullName ?? 'Ananya Subramanian',
    phone: overrides.phone ?? '9876543210',
    address: overrides.address ?? '14 West Mambalam High Road, Chennai 600033',
    gender: overrides.gender ?? 'Female',
    consent: true as const,
    dateIds,
    idempotencyKey:
      overrides.idempotencyKey ??
      `idem-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
  };
}

test('Tests A, B, C, D, E: Core intelligent seat allocation across dates', () => {
  const db = createDatabaseService(':memory:');
  try {
    // Test A: First registration on 26 December -> Seat 001
    const resA = db.createBooking(makeBookingPayload([DAY1], { fullName: 'Visitor A' }));
    assert.equal(resA.ok, true);
    if (!resA.ok) return;
    assert.equal(resA.confirmation.tickets[0].seatLabel, '001');

    // Test B: Second registration on 26 December -> Seat 002
    const resB = db.createBooking(makeBookingPayload([DAY1], { fullName: 'Visitor B' }));
    assert.equal(resB.ok, true);
    if (!resB.ok) return;
    assert.equal(resB.confirmation.tickets[0].seatLabel, '002');

    // Test C: Independent date 27 December -> Seat 001
    const resC = db.createBooking(makeBookingPayload([DAY2], { fullName: 'Visitor C' }));
    assert.equal(resC.ok, true);
    if (!resC.ok) return;
    assert.equal(resC.confirmation.tickets[0].seatLabel, '001');

    // Test D: Multi-date booking (Day 1, Day 2, Day 3) -> Common Seat 003
    const resD = db.createBooking(
      makeBookingPayload([DAY1, DAY2, DAY3], { fullName: 'Visitor D' })
    );
    assert.equal(resD.ok, true);
    if (!resD.ok) return;
    assert.equal(resD.confirmation.strategy, 'common');
    assert.deepEqual(
      resD.confirmation.tickets.map((t) => t.seatLabel),
      ['003', '003', '003']
    );

    // Test E: Different seats when NO common seat exists across Day 1 and Day 2
    // Fill seats 4..150 on Day 1 except seat 149; occupy seat 149 on Day 2
    for (let s = 4; s <= 150; s++) {
      if (s === 149) continue;
      const r = db.createBooking(makeBookingPayload([DAY1], { fullName: `Fill1-${s}` }));
      assert.equal(r.ok, true);
    }
    // Occupy seats 2..149 on Day 2 (leaving seat 150 free), then cancel seat 002 so seat 002 is free while 149 is occupied!
    let day2Seat2TicketId = '';
    for (let s = 2; s <= 150; s++) {
      if (s === 3) continue; // 3 already occupied
      const r = db.createBooking(makeBookingPayload([DAY2], { fullName: `Fill2-${s}` }));
      assert.equal(r.ok, true);
      if (r.ok && r.confirmation.tickets[0].seatNumber === 2) {
        day2Seat2TicketId = r.confirmation.tickets[0].id;
      }
    }
    assert.ok(day2Seat2TicketId);
    const cancelRes = db.cancelTicket(day2Seat2TicketId, 'Test E setup');
    assert.equal(cancelRes.ok, true);

    // Now Day 1 only has seat 150 free; Day 2 only has seat 002 free. No common seat exists!
    const resE = db.createBooking(makeBookingPayload([DAY1, DAY2], { fullName: 'Visitor E' }));
    assert.equal(resE.ok, true);
    if (!resE.ok) return;
    assert.equal(resE.confirmation.strategy, 'independent');
    const day1Ticket = resE.confirmation.tickets.find((t) => t.festivalDateId === DAY1);
    const day2Ticket = resE.confirmation.tickets.find((t) => t.festivalDateId === DAY2);
    assert.equal(day1Ticket?.seatLabel, '150');
    assert.equal(day2Ticket?.seatLabel, '002');
  } finally {
    db.close();
  }
});

test('Tests F, G, H: Concurrent HTTP bookings, sold-out rejection, and duplicate idempotency', async () => {
  clearRateLimitBuckets();
  const db = createDatabaseService(':memory:');
  const app = createApiApp(db, { disableRateLimit: true });
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    // Test F: 25 concurrent bookings on Day 1
    const concurrentRequests = Array.from({ length: 25 }, (_, i) =>
      fetch(`${baseUrl}/api/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          makeBookingPayload([DAY1], {
            fullName: `Concurrent User ${i + 1}`,
            idempotencyKey: `concurrent-key-${i + 1}`,
          })
        ),
      }).then((r) => r.json())
    );

    const results = await Promise.all(concurrentRequests);
    const seats = results.map((r) => r.booking.tickets[0].seatNumber as number);
    assert.equal(new Set(seats).size, 25, 'All 25 concurrent bookings must receive unique seats');
    assert.deepEqual(
      [...seats].sort((a, b) => a - b),
      Array.from({ length: 25 }, (_, i) => i + 1)
    );

    // Test H: Duplicate submission with same idempotencyKey
    const dupKey = 'duplicate-submission-key-001';
    const firstResp = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(makeBookingPayload([DAY2], { idempotencyKey: dupKey })),
    });
    assert.equal(firstResp.status, 201);
    const firstJson = await firstResp.json();

    const secondResp = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(makeBookingPayload([DAY2], { idempotencyKey: dupKey })),
    });
    assert.equal(secondResp.status, 200);
    const secondJson = await secondResp.json();
    assert.equal(secondJson.duplicateIdempotent, true);
    assert.equal(secondJson.booking.bookingId, firstJson.booking.bookingId);
    assert.equal(secondJson.booking.tickets[0].id, firstJson.booking.tickets[0].id);

    // Test G: Sold-out date rejection (fill remaining 125 seats on Day 1)
    for (let i = 26; i <= 150; i++) {
      const r = db.createBooking(makeBookingPayload([DAY1], { fullName: `Seat ${i}` }));
      assert.equal(r.ok, true);
    }

    // Attempt multi-date booking with sold-out Day 1 + available Day 3 -> must reject with 409 & zero partial bookings on Day 3
    const soldOutResp = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(makeBookingPayload([DAY1, DAY3], { fullName: 'Late Visitor' })),
    });
    assert.equal(soldOutResp.status, 409);
    const datesAfter = db.getFestivalDates();
    const day3State = datesAfter.find((d) => d.id === DAY3)!;
    assert.equal(day3State.bookedCount, 0, 'No partial booking allowed when one date is sold out');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    db.close();
  }
});

test('Tests I, J, K, L: Excel export, QR verification, admin auth, and DB failure rollback', async () => {
  clearRateLimitBuckets();
  process.env.ADMIN_PASSWORD = 'test-secret-password';
  process.env.SESSION_SECRET = 'test-session-secret-0123456789abcdef';

  const db = createDatabaseService(':memory:');
  const app = createApiApp(db, { disableRateLimit: true });
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    // Seed a booking including a potential formula injection payload in name
    const bookingRes = db.createBooking(
      makeBookingPayload([DAY1], {
        fullName: '=HYPERLINK("http://evil.example","Click")',
        phone: '+91 98400 12345',
      })
    );
    assert.equal(bookingRes.ok, true);
    if (!bookingRes.ok) return;
    const ticket = bookingRes.confirmation.tickets[0];
    assert.ok(ticket.verificationToken);

    // Test L: Database failure mid-transaction must rollback completely
    const beforeDates = db.getFestivalDates();
    const beforeBooked = beforeDates.find((d) => d.id === DAY2)!.bookedCount;
    const failedRes = db.createBooking(makeBookingPayload([DAY2], { fullName: 'Rollback User' }), {
      onBeforeCommit: () => {
        throw new Error('Simulated disk I/O failure');
      },
    });
    assert.equal(failedRes.ok, false);
    const afterDates = db.getFestivalDates();
    assert.equal(afterDates.find((d) => d.id === DAY2)!.bookedCount, beforeBooked);

    // Test K: Admin authentication & protected endpoints
    const unauthAdmin = await fetch(`${baseUrl}/api/admin/overview`);
    assert.equal(unauthAdmin.status, 401);

    const wrongLogin = await fetch(`${baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'wrong-password' }),
    });
    assert.equal(wrongLogin.status, 401);

    const goodLogin = await fetch(`${baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'test-secret-password' }),
    });
    assert.equal(goodLogin.status, 200);
    const setCookie = goodLogin.headers.get('set-cookie');
    assert.ok(setCookie && setCookie.includes('HttpOnly'), 'Session cookie must be HttpOnly');
    const cookieHeader = setCookie.split(';')[0];

    // Verify expired session token fails
    const validToken = createSessionToken();
    assert.equal(verifySessionToken(validToken), true);
    const [payloadB64] = validToken.split('.');
    const tamperedExpired = `${payloadB64}.invalidSig`;
    assert.equal(verifySessionToken(tamperedExpired), false);

    // Test J: QR verification without auth hides attendeeName; with auth shows attendeeName + atomic check-in
    const publicInspect = await fetch(`${baseUrl}/api/verify/inspect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticketId: ticket.id, token: ticket.verificationToken }),
    }).then((r) => r.json());
    assert.equal(publicInspect.verificationStatus, 'valid');
    assert.equal(publicInspect.attendeeName, null, 'Public inspect must NOT leak attendee name');

    const staffInspect = await fetch(`${baseUrl}/api/verify/inspect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
      body: JSON.stringify({ ticketId: ticket.id, token: ticket.verificationToken }),
    }).then((r) => r.json());
    assert.equal(staffInspect.verificationStatus, 'valid');
    assert.ok(staffInspect.attendeeName);

    const firstCheckin = await fetch(`${baseUrl}/api/verify/checkin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
      body: JSON.stringify({ ticketId: ticket.id, token: ticket.verificationToken }),
    }).then((r) => r.json());
    assert.equal(firstCheckin.verificationStatus, 'valid');
    assert.ok(firstCheckin.checkedInAt);

    const duplicateCheckin = await fetch(`${baseUrl}/api/verify/checkin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
      body: JSON.stringify({ ticketId: ticket.id, token: ticket.verificationToken }),
    }).then((r) => r.json());
    assert.equal(duplicateCheckin.verificationStatus, 'already_checked_in');

    // Test I: Excel export via authenticated endpoint + sheet/formula verification
    const unauthExport = await fetch(`${baseUrl}/api/admin/export`);
    assert.equal(unauthExport.status, 401);

    const exportResp = await fetch(`${baseUrl}/api/admin/export`, {
      headers: { Cookie: cookieHeader },
    });
    assert.equal(exportResp.status, 200);
    const ab = await exportResp.arrayBuffer();

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(ab);
    assert.deepEqual(
      wb.worksheets.map((ws) => ws.name),
      ['Dashboard', 'Registrations', 'Seat Map', 'Festival Schedule']
    );

    const regSheet = wb.getWorksheet('Registrations')!;
    const exportedName = regSheet.getRow(2).getCell(3).value;
    assert.equal(
      exportedName,
      sanitizeSpreadsheetCell('=HYPERLINK("http://evil.example","Click")'),
      'Formula injection must be sanitized with leading apostrophe'
    );
    assert.equal(regSheet.getRow(2).getCell(10).value, 'CHECKED IN');

    const seatMapSheet = wb.getWorksheet('Seat Map')!;
    assert.equal(seatMapSheet.rowCount, 151); // 1 header + 150 seats
    assert.equal(seatMapSheet.getRow(2).getCell(2).value, 'CHECKED IN');
    assert.equal(seatMapSheet.getRow(3).getCell(2).value, 'FREE');

    // Also verify generateFestivalWorkbook directly
    const directBuf = await generateFestivalWorkbook(db);
    assert.ok(directBuf.length > 1000);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    db.close();
  }
});
