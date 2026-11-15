import cookieParser from 'cookie-parser';
import express, { type NextFunction, type Request, type Response } from 'express';
import { AdminLoginSchema, CreateBookingSchema, VerifyTicketSchema } from '../shared/validation';
import type { DatabaseService } from './db';
import { generateFestivalWorkbook } from './excelExport';
import {
  checkRateLimit,
  clearAdminSessionCookie,
  createSessionToken,
  isAdminAuthenticated,
  setAdminSessionCookie,
  verifyAdminPassword,
  verifyBookingAccessToken,
} from './security';

export interface CreateAppOptions {
  disableRateLimit?: boolean;
}

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || 'unknown';
}

export function createApiApp(dbService: DatabaseService, options: CreateAppOptions = {}) {
  const app = express();
  app.use(express.json({ limit: '64kb' }));
  app.use(cookieParser());

  function requireAdmin(req: Request, res: Response, next: NextFunction) {
    if (!isAdminAuthenticated(req)) {
      return res.status(401).json({ error: 'Administrator authentication required.' });
    }
    return next();
  }

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'MARGAZHI' });
  });

  // Public festival schedule & live remaining seats (zero PII)
  app.get('/api/dates', (_req, res) => {
    try {
      const dates = dbService.getFestivalDates();
      res.json({ dates });
    } catch (error) {
      console.error('Error fetching festival dates:', error);
      res.status(500).json({ error: 'Unable to load festival schedule.' });
    }
  });

  // Create booking transactionally
  app.post('/api/bookings', (req, res) => {
    if (!options.disableRateLimit) {
      const ip = getClientIp(req);
      const rl = checkRateLimit(`book:${ip}`, 30, 15 * 60 * 1000);
      if (!rl.allowed) {
        res.setHeader('Retry-After', String(rl.retryAfterSeconds));
        return res.status(429).json({
          error: 'Too many booking attempts. Please wait a moment and try again.',
        });
      }
    }

    const parsed = CreateBookingSchema.safeParse(req.body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return res.status(400).json({
        error: firstIssue?.message ?? 'Invalid registration details.',
        fieldErrors: parsed.error.flatten().fieldErrors,
      });
    }

    const result = dbService.createBooking(parsed.data);
    if (!result.ok) {
      return res.status(result.statusCode).json({
        error: result.error,
        soldOutDateIds: result.soldOutDateIds ?? [],
      });
    }

    return res.status(result.duplicateIdempotent ? 200 : 201).json({
      booking: result.confirmation,
      duplicateIdempotent: result.duplicateIdempotent,
    });
  });

  // Secure booking confirmation lookup (requires HMAC booking access token or admin session)
  app.get('/api/bookings/:bookingId', (req, res) => {
    const { bookingId } = req.params;
    const accessToken = typeof req.query.access === 'string' ? req.query.access : undefined;
    const isAdmin = isAdminAuthenticated(req);

    if (!isAdmin && !verifyBookingAccessToken(bookingId, accessToken)) {
      return res.status(403).json({ error: 'Invalid or missing booking access token.' });
    }

    const confirmation = dbService.getBookingConfirmation(bookingId, accessToken, isAdmin);
    if (!confirmation) {
      return res.status(404).json({ error: 'Booking not found.' });
    }

    return res.json({ booking: confirmation });
  });

  // Secure individual ticket lookup (requires verification token or admin session)
  app.get('/api/tickets/:ticketId', (req, res) => {
    const { ticketId } = req.params;
    const token = typeof req.query.token === 'string' ? req.query.token : undefined;
    const isAdmin = isAdminAuthenticated(req);

    const ticket = dbService.getTicketById(ticketId, token, isAdmin);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found or verification token invalid.' });
    }

    return res.json({ ticket });
  });

  // Ticket QR verification inspection (does NOT expose attendee name unless staff logged in)
  app.post('/api/verify/inspect', (req, res) => {
    const parsed = VerifyTicketSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Ticket ID and verification token are required.' });
    }

    const isStaff = isAdminAuthenticated(req);
    const referenceDate =
      typeof req.body.referenceDate === 'string' && req.body.referenceDate.length === 10
        ? req.body.referenceDate
        : undefined;

    const result = dbService.inspectTicket(
      parsed.data.ticketId,
      parsed.data.token,
      isStaff,
      referenceDate
    );

    return res.json(result);
  });

  // Atomic check-in via QR scanner (staff/admin session required)
  app.post('/api/verify/checkin', requireAdmin, (req, res) => {
    const parsed = VerifyTicketSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Ticket ID and verification token are required.' });
    }

    const result = dbService.checkInTicket(parsed.data.ticketId, parsed.data.token, true);
    return res.json(result);
  });

  // Admin Authentication
  app.post('/api/admin/login', (req, res) => {
    if (!options.disableRateLimit) {
      const ip = getClientIp(req);
      const rl = checkRateLimit(`admin-login:${ip}`, 10, 15 * 60 * 1000);
      if (!rl.allowed) {
        res.setHeader('Retry-After', String(rl.retryAfterSeconds));
        return res.status(429).json({
          error: 'Too many login attempts. Please try again in a few minutes.',
        });
      }
    }

    const parsed = AdminLoginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Please enter the administrator password.' });
    }

    if (!verifyAdminPassword(parsed.data.password)) {
      dbService.recordAuditLog('ADMIN_LOGIN_FAILED', null, { ip: getClientIp(req) });
      return res.status(401).json({ error: 'Invalid administrator password.' });
    }

    const token = createSessionToken();
    setAdminSessionCookie(res, token, req);
    dbService.recordAuditLog('ADMIN_LOGIN_SUCCESS', null, {});
    return res.json({ authenticated: true });
  });

  app.post('/api/admin/logout', (req, res) => {
    clearAdminSessionCookie(res);
    return res.json({ authenticated: false });
  });

  app.get('/api/admin/session', (req, res) => {
    return res.json({ authenticated: isAdminAuthenticated(req) });
  });

  // Protected Admin Endpoints
  app.get('/api/admin/overview', requireAdmin, (_req, res) => {
    const overview = dbService.getAdminOverview();
    res.json(overview);
  });

  app.get('/api/admin/registrations', requireAdmin, (req, res) => {
    const registrations = dbService.getAdminRegistrations({
      dateId: typeof req.query.dateId === 'string' ? req.query.dateId : undefined,
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
      checkInStatus:
        typeof req.query.checkInStatus === 'string' ? req.query.checkInStatus : undefined,
      registrationDate:
        typeof req.query.registrationDate === 'string' ? req.query.registrationDate : undefined,
    });
    res.json({ registrations });
  });

  app.get('/api/admin/seats/:dateId', requireAdmin, (req, res) => {
    const mapData = dbService.getAdminSeatMap(req.params.dateId);
    if (!mapData) {
      return res.status(404).json({ error: 'Festival date not found.' });
    }
    return res.json(mapData);
  });

  app.post('/api/admin/tickets/:ticketId/checkin', requireAdmin, (req, res) => {
    const result = dbService.checkInTicket(req.params.ticketId, undefined, false);
    if (result.verificationStatus === 'invalid') {
      return res.status(404).json(result);
    }
    return res.json(result);
  });

  app.post('/api/admin/tickets/:ticketId/cancel', requireAdmin, (req, res) => {
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : undefined;
    const result = dbService.cancelTicket(req.params.ticketId, reason);
    if (!result.ok) {
      return res.status(400).json({ error: result.error });
    }
    return res.json({ ok: true });
  });

  app.patch('/api/admin/dates/:dateId', requireAdmin, (req, res) => {
    const status = req.body?.bookingStatus;
    if (status !== 'open' && status !== 'closed') {
      return res.status(400).json({ error: 'Invalid booking status.' });
    }
    const ok = dbService.updateDateBookingStatus(req.params.dateId, status);
    if (!ok) {
      return res.status(404).json({ error: 'Festival date not found.' });
    }
    return res.json({ ok: true, bookingStatus: status });
  });

  app.get('/api/admin/audit-logs', requireAdmin, (_req, res) => {
    const logs = dbService.getAuditLogs(100);
    res.json({ logs });
  });

  app.get('/api/admin/export', requireAdmin, async (req, res) => {
    try {
      const dateId = typeof req.query.dateId === 'string' ? req.query.dateId : undefined;
      const buffer = await generateFestivalWorkbook(dbService, { dateId });
      dbService.recordAuditLog('EXCEL_EXPORT', dateId ?? 'all', {});

      const suffix = dateId && dateId !== 'all' ? dateId : 'full-festival';
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="margazhi-2026-${suffix}.xlsx"`
      );
      res.send(buffer);
    } catch (error) {
      console.error('Excel export failed:', error);
      res.status(500).json({ error: 'Failed to generate Excel report.' });
    }
  });

  return app;
}
