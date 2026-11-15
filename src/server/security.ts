import crypto from 'node:crypto';
import type { Request, Response } from 'express';

const COOKIE_NAME = 'margazhi_admin_session';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

// Ephemeral fallback only for non-production local runs if env var is unset
const EPHEMERAL_DEV_SECRET = crypto.randomBytes(32).toString('hex');

export function getSessionSecret(): string {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16) {
    return process.env.SESSION_SECRET;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET environment variable must be configured in production.');
  }
  return process.env.SESSION_SECRET || EPHEMERAL_DEV_SECRET;
}

export function getAdminPassword(): string {
  if (process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.length > 0) {
    return process.env.ADMIN_PASSWORD;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('ADMIN_PASSWORD environment variable must be configured in production.');
  }
  return 'margazhi2026';
}

export function verifyAdminPassword(candidate: string): boolean {
  const expected = getAdminPassword();
  const candidateHash = crypto.createHash('sha256').update(candidate).digest();
  const expectedHash = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(candidateHash, expectedHash);
}

export function createSessionToken(): string {
  const payload = Buffer.from(
    JSON.stringify({
      role: 'admin',
      iat: Date.now(),
      exp: Date.now() + SESSION_TTL_MS,
      nonce: crypto.randomBytes(8).toString('hex'),
    })
  ).toString('base64url');

  const sig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(payload)
    .digest('base64url');

  return `${payload}.${sig}`;
}

export function verifySessionToken(token: string | undefined): boolean {
  if (!token || !token.includes('.')) return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payload, sig] = parts;

  const expectedSig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(payload)
    .digest('base64url');

  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length) return false;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return false;

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      role?: string;
      exp?: number;
    };
    if (parsed.role !== 'admin') return false;
    if (!parsed.exp || Date.now() > parsed.exp) return false;
    return true;
  } catch {
    return false;
  }
}

export function setAdminSessionCookie(res: Response, token: string, req: Request): void {
  const isHttps =
    req.secure ||
    req.headers['x-forwarded-proto'] === 'https' ||
    process.env.NODE_ENV === 'production';

  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isHttps,
    maxAge: SESSION_TTL_MS,
    path: '/',
  });
}

export function clearAdminSessionCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  });
}

export function isAdminAuthenticated(req: Request): boolean {
  const token = req.cookies?.[COOKIE_NAME] as string | undefined;
  return verifySessionToken(token);
}

/**
 * Generates an unguessable QR verification token and its SHA-256 database hash.
 */
export function generateVerificationTokenPair(): { rawToken: string; tokenHash: string } {
  const rawToken = crypto.randomBytes(24).toString('base64url');
  const tokenHash = hashVerificationToken(rawToken);
  return { rawToken, tokenHash };
}

export function hashVerificationToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export function createBookingAccessToken(bookingId: string): string {
  const sig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(`booking:${bookingId}`)
    .digest('base64url');
  return sig;
}

export function verifyBookingAccessToken(bookingId: string, token: string | undefined): boolean {
  if (!token) return false;
  const expected = createBookingAccessToken(bookingId);
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Sliding-window in-memory rate limiter for booking and login endpoints.
 */
const rateLimitBuckets = new Map<string, number[]>();

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const windowStart = now - windowMs;
  const timestamps = (rateLimitBuckets.get(key) ?? []).filter((t) => t > windowStart);

  if (timestamps.length >= maxRequests) {
    const oldest = timestamps[0] ?? now;
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    rateLimitBuckets.set(key, timestamps);
    return { allowed: false, retryAfterSeconds };
  }

  timestamps.push(now);
  rateLimitBuckets.set(key, timestamps);
  return { allowed: true, retryAfterSeconds: 0 };
}

export function clearRateLimitBuckets(): void {
  rateLimitBuckets.clear();
}
