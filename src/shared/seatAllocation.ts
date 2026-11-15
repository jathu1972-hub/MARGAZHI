export interface SeatAllocationResult {
  ok: true;
  strategy: 'common' | 'independent';
  assignments: Array<{
    festivalDateId: string;
    seatNumber: number;
    seatLabel: string;
  }>;
}

export interface SeatAllocationError {
  ok: false;
  reason: 'EMPTY_SELECTION' | 'SOLD_OUT';
  soldOutDateIds: string[];
  message: string;
}

export function formatSeatNumber(seatNumber: number): string {
  return String(seatNumber).padStart(3, '0');
}

export function formatTicketId(eventDate: string, sequence: number): string {
  const compactDate = eventDate.replace(/-/g, '');
  const seq = String(sequence).padStart(4, '0');
  return `MRG-${compactDate}-${seq}`;
}

/**
 * Core intelligent seat allocation algorithm.
 * - Deduplicates selectedDateIds while preserving order.
 * - Rejects if any selected date has reached capacity (no partial bookings).
 * - Searches for the lowest-numbered seat (1..capacity) free across ALL selected dates.
 * - If a common seat exists, assigns that exact seat number to every selected date.
 * - Otherwise, independently assigns the lowest-numbered free seat for each date.
 */
export function allocateSeatsForDates(
  selectedDateIds: string[],
  occupiedSeatsByDate: Map<string, Set<number>>,
  capacityByDate?: Map<string, number>,
  defaultCapacity = 150
): SeatAllocationResult | SeatAllocationError {
  const uniqueDateIds = Array.from(new Set(selectedDateIds.filter(Boolean)));
  if (uniqueDateIds.length === 0) {
    return {
      ok: false,
      reason: 'EMPTY_SELECTION',
      soldOutDateIds: [],
      message: 'Please select at least one festival date.',
    };
  }

  const soldOutDateIds: string[] = [];
  for (const dateId of uniqueDateIds) {
    const cap = capacityByDate?.get(dateId) ?? defaultCapacity;
    const occupied = occupiedSeatsByDate.get(dateId) ?? new Set<number>();
    let hasFreeSeat = false;
    for (let seat = 1; seat <= cap; seat++) {
      if (!occupied.has(seat)) {
        hasFreeSeat = true;
        break;
      }
    }
    if (!hasFreeSeat) {
      soldOutDateIds.push(dateId);
    }
  }

  if (soldOutDateIds.length > 0) {
    return {
      ok: false,
      reason: 'SOLD_OUT',
      soldOutDateIds,
      message: 'One or more selected festival dates are sold out.',
    };
  }

  const minCommonCapacity = Math.min(
    ...uniqueDateIds.map((id) => capacityByDate?.get(id) ?? defaultCapacity)
  );

  // Step 1: Attempt to find lowest seat available across ALL selected dates
  let commonSeat: number | null = null;
  for (let seat = 1; seat <= minCommonCapacity; seat++) {
    const availableOnAll = uniqueDateIds.every((dateId) => {
      const occupied = occupiedSeatsByDate.get(dateId);
      return !occupied || !occupied.has(seat);
    });
    if (availableOnAll) {
      commonSeat = seat;
      break;
    }
  }

  if (commonSeat !== null) {
    return {
      ok: true,
      strategy: 'common',
      assignments: uniqueDateIds.map((festivalDateId) => ({
        festivalDateId,
        seatNumber: commonSeat!,
        seatLabel: formatSeatNumber(commonSeat!),
      })),
    };
  }

  // Step 2: Otherwise allocate lowest free seat independently per date
  const assignments = uniqueDateIds.map((festivalDateId) => {
    const cap = capacityByDate?.get(festivalDateId) ?? defaultCapacity;
    const occupied = occupiedSeatsByDate.get(festivalDateId) ?? new Set<number>();
    for (let seat = 1; seat <= cap; seat++) {
      if (!occupied.has(seat)) {
        return {
          festivalDateId,
          seatNumber: seat,
          seatLabel: formatSeatNumber(seat),
        };
      }
    }
    throw new Error(`Invariant violation: no seat found for ${festivalDateId}`);
  });

  return {
    ok: true,
    strategy: 'independent',
    assignments,
  };
}

/**
 * Validates and normalizes Indian phone numbers.
 * Accepts: 9876543210, +91 98765 43210, 09876543210, 919876543210
 * Returns normalized 10-digit string (e.g. "9876543210") or null if invalid.
 */
export function normalizeIndianPhone(raw: string): string | null {
  const digits = raw.replace(/[\s\-().+]/g, '');
  let national = digits;
  if (digits.length === 12 && digits.startsWith('91')) {
    national = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith('0')) {
    national = digits.slice(1);
  }
  if (/^[6-9]\d{9}$/.test(national)) {
    return national;
  }
  return null;
}

export function formatIndianPhoneDisplay(phone: string): string {
  const normalized = normalizeIndianPhone(phone);
  if (!normalized) return phone;
  return `+91 ${normalized.slice(0, 5)} ${normalized.slice(5)}`;
}

/**
 * Protects Excel / CSV exports against spreadsheet formula injection (CWE-1236).
 */
export function sanitizeSpreadsheetCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.length === 0) return '';
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
}
