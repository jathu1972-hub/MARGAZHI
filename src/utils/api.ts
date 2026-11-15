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

async function handleJson<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error((data as { error?: string }).error || 'Request failed') as Error & {
      status?: number;
      soldOutDateIds?: string[];
    };
    err.status = res.status;
    err.soldOutDateIds = (data as { soldOutDateIds?: string[] }).soldOutDateIds;
    throw err;
  }
  return data as T;
}

export async function fetchFestivalDates(): Promise<FestivalDateDTO[]> {
  const res = await fetch('/api/dates');
  const data = await handleJson<{ dates: FestivalDateDTO[] }>(res);
  return data.dates;
}

export async function submitBooking(
  payload: CreateBookingInput
): Promise<{ booking: BookingConfirmationDTO; duplicateIdempotent: boolean }> {
  const res = await fetch('/api/bookings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleJson<{ booking: BookingConfirmationDTO; duplicateIdempotent: boolean }>(res);
}

export async function fetchBookingConfirmation(
  bookingId: string,
  accessToken: string
): Promise<BookingConfirmationDTO> {
  const res = await fetch(
    `/api/bookings/${encodeURIComponent(bookingId)}?access=${encodeURIComponent(accessToken)}`
  );
  const data = await handleJson<{ booking: BookingConfirmationDTO }>(res);
  return data.booking;
}

export async function fetchPublicTicket(
  ticketId: string,
  token: string
): Promise<PublicTicketDTO> {
  const res = await fetch(
    `/api/tickets/${encodeURIComponent(ticketId)}?token=${encodeURIComponent(token)}`
  );
  const data = await handleJson<{ ticket: PublicTicketDTO }>(res);
  return data.ticket;
}

export async function inspectVerification(
  ticketId: string,
  token: string,
  referenceDate?: string
): Promise<VerificationResultDTO> {
  const res = await fetch('/api/verify/inspect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ticketId, token, referenceDate }),
  });
  return handleJson<VerificationResultDTO>(res);
}

export async function confirmVerificationCheckIn(
  ticketId: string,
  token: string
): Promise<VerificationResultDTO> {
  const res = await fetch('/api/verify/checkin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ticketId, token }),
  });
  return handleJson<VerificationResultDTO>(res);
}

export async function checkAdminSession(): Promise<boolean> {
  const res = await fetch('/api/admin/session');
  const data = await handleJson<{ authenticated: boolean }>(res);
  return data.authenticated;
}

export async function adminLogin(password: string): Promise<boolean> {
  const res = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  const data = await handleJson<{ authenticated: boolean }>(res);
  return data.authenticated;
}

export async function adminLogout(): Promise<void> {
  await fetch('/api/admin/logout', { method: 'POST' });
}

export async function fetchAdminOverview(): Promise<{
  totalBookings: number;
  totalReservations: number;
  totalCheckedIn: number;
  capacityPerDate: number;
  dates: FestivalDateDTO[];
}> {
  const res = await fetch('/api/admin/overview');
  return handleJson(res);
}

export async function fetchAdminRegistrations(params: {
  dateId?: string;
  search?: string;
  checkInStatus?: string;
  registrationDate?: string;
}): Promise<AdminRegistrationRow[]> {
  const qs = new URLSearchParams();
  if (params.dateId) qs.set('dateId', params.dateId);
  if (params.search) qs.set('search', params.search);
  if (params.checkInStatus) qs.set('checkInStatus', params.checkInStatus);
  if (params.registrationDate) qs.set('registrationDate', params.registrationDate);
  const res = await fetch(`/api/admin/registrations?${qs.toString()}`);
  const data = await handleJson<{ registrations: AdminRegistrationRow[] }>(res);
  return data.registrations;
}

export async function fetchAdminSeatMap(
  dateId: string
): Promise<{ date: FestivalDateDTO; seats: AdminSeatCell[] }> {
  const res = await fetch(`/api/admin/seats/${encodeURIComponent(dateId)}`);
  return handleJson(res);
}

export async function adminCheckInTicket(ticketId: string): Promise<VerificationResultDTO> {
  const res = await fetch(`/api/admin/tickets/${encodeURIComponent(ticketId)}/checkin`, {
    method: 'POST',
  });
  return handleJson(res);
}

export async function adminCancelTicket(ticketId: string, reason?: string): Promise<void> {
  const res = await fetch(`/api/admin/tickets/${encodeURIComponent(ticketId)}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
  await handleJson(res);
}

export async function adminUpdateDateStatus(
  dateId: string,
  bookingStatus: 'open' | 'closed'
): Promise<void> {
  const res = await fetch(`/api/admin/dates/${encodeURIComponent(dateId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bookingStatus }),
  });
  await handleJson(res);
}

export async function fetchAdminAuditLogs(): Promise<AdminAuditLogRow[]> {
  const res = await fetch('/api/admin/audit-logs');
  const data = await handleJson<{ logs: AdminAuditLogRow[] }>(res);
  return data.logs;
}
