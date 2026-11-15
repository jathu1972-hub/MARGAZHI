export interface ConcertSessionDTO {
  id: string;
  festivalDateId: string;
  startTime: string;
  endTime: string;
  title: string;
  performers: string[];
  displayOrder: number;
}

export interface FestivalDateDTO {
  id: string;
  dayNumber: number;
  eventDate: string;
  dayName: string;
  dayAbbr: string;
  dateNumber: string;
  monthAbbr: string;
  monthFull: string;
  year: string;
  title: string;
  capacity: number;
  bookingStatus: 'open' | 'closed';
  bookedCount: number;
  remainingSeats: number;
  checkedInCount: number;
  sessions: ConcertSessionDTO[];
}

export interface PublicTicketDTO {
  id: string;
  bookingId: string;
  festivalDateId: string;
  eventDate: string;
  dayName: string;
  dayNumber: number;
  dateTitle: string;
  sessions: ConcertSessionDTO[];
  seatNumber: number;
  seatLabel: string;
  attendeeName: string;
  venue: string;
  venueAddress: string;
  organizer: string;
  status: 'confirmed' | 'checked_in' | 'cancelled';
  checkedInAt: string | null;
  createdAt: string;
  verificationToken?: string;
}

export interface BookingConfirmationDTO {
  bookingId: string;
  accessToken: string;
  attendeeName: string;
  strategy: 'common' | 'independent';
  createdAt: string;
  tickets: PublicTicketDTO[];
}

export type VerificationStatus =
  | 'valid'
  | 'already_checked_in'
  | 'invalid'
  | 'cancelled'
  | 'wrong_event_date';

export interface VerificationResultDTO {
  verificationStatus: VerificationStatus;
  message: string;
  ticketId: string | null;
  eventDate: string | null;
  dayName: string | null;
  dateTitle: string | null;
  seatLabel: string | null;
  checkedInAt: string | null;
  attendeeName: string | null; // only populated for authorized staff
  isStaffAuthenticated: boolean;
}

export interface AdminRegistrationRow {
  ticketId: string;
  bookingId: string;
  seatNumber: number;
  seatLabel: string;
  fullName: string;
  phone: string;
  address: string;
  gender: string;
  festivalDateId: string;
  eventDate: string;
  dayName: string;
  ticketStatus: 'confirmed' | 'checked_in' | 'cancelled';
  checkedInAt: string | null;
  createdAt: string;
}

export interface AdminSeatCell {
  seatNumber: number;
  seatLabel: string;
  status: 'available' | 'booked' | 'checked_in';
  registration: AdminRegistrationRow | null;
}

export interface AdminAuditLogRow {
  id: number;
  action: string;
  targetId: string | null;
  timestamp: string;
  metadata: Record<string, unknown>;
}
