import ExcelJS from 'exceljs';
import { FESTIVAL_INFO } from '../shared/festivalSchedule';
import {
  formatIndianPhoneDisplay,
  formatSeatNumber,
  sanitizeSpreadsheetCell,
} from '../shared/seatAllocation';
import type { DatabaseService } from './db';

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF242424' },
};

const HEADER_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  color: { argb: 'FFFAF8F4' },
  size: 11,
};

function styleHeaderRow(row: ExcelJS.Row) {
  row.height = 24;
  row.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'FFB49A6C' } },
    };
  });
}

export async function generateFestivalWorkbook(
  dbService: DatabaseService,
  options?: { dateId?: string }
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = FESTIVAL_INFO.organizer;
  workbook.created = new Date();

  const allDates = dbService.getFestivalDates();
  const targetDates =
    options?.dateId && options.dateId !== 'all'
      ? allDates.filter((d) => d.id === options.dateId)
      : allDates;

  const registrations = dbService.getAdminRegistrations(
    options?.dateId && options.dateId !== 'all' ? { dateId: options.dateId } : undefined
  );

  // Sheet 1 — Dashboard
  const dashboardSheet = workbook.addWorksheet('Dashboard', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  dashboardSheet.columns = [
    { header: 'Event Date', key: 'eventDate', width: 15 },
    { header: 'Day', key: 'dayName', width: 14 },
    { header: 'Concert', key: 'concert', width: 52 },
    { header: 'Total Seats', key: 'totalSeats', width: 14 },
    { header: 'Registered Seats', key: 'registeredSeats', width: 18 },
    { header: 'Remaining Seats', key: 'remainingSeats', width: 18 },
    { header: 'Check-ins', key: 'checkIns', width: 14 },
    { header: 'Occupancy Percentage', key: 'occupancyPct', width: 22 },
  ];
  styleHeaderRow(dashboardSheet.getRow(1));
  dashboardSheet.autoFilter = {
    from: 'A1',
    to: 'H1',
  };

  for (const d of targetDates) {
    const pct = d.capacity > 0 ? ((d.bookedCount / d.capacity) * 100).toFixed(1) + '%' : '0.0%';
    dashboardSheet.addRow({
      eventDate: d.eventDate,
      dayName: d.dayName,
      concert: sanitizeSpreadsheetCell(d.title),
      totalSeats: d.capacity,
      registeredSeats: d.bookedCount,
      remainingSeats: d.remainingSeats,
      checkIns: d.checkedInCount,
      occupancyPct: pct,
    });
  }

  // Sheet 2 — Registrations
  const regSheet = workbook.addWorksheet('Registrations', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  regSheet.columns = [
    { header: 'Booking ID', key: 'bookingId', width: 18 },
    { header: 'Ticket ID', key: 'ticketId', width: 22 },
    { header: 'Full Name', key: 'fullName', width: 26 },
    { header: 'Phone Number', key: 'phone', width: 18 },
    { header: 'Address', key: 'address', width: 38 },
    { header: 'Gender', key: 'gender', width: 18 },
    { header: 'Event Date', key: 'eventDate', width: 15 },
    { header: 'Seat Number', key: 'seatNumber', width: 14 },
    { header: 'Registration Date and Time', key: 'createdAt', width: 26 },
    { header: 'Check-in Status', key: 'checkInStatus', width: 18 },
  ];
  styleHeaderRow(regSheet.getRow(1));
  regSheet.autoFilter = {
    from: 'A1',
    to: 'J1',
  };

  for (const reg of registrations) {
    const statusLabel =
      reg.ticketStatus === 'checked_in'
        ? 'CHECKED IN'
        : reg.ticketStatus === 'cancelled'
          ? 'CANCELLED'
          : 'CONFIRMED';

    regSheet.addRow({
      bookingId: sanitizeSpreadsheetCell(reg.bookingId),
      ticketId: sanitizeSpreadsheetCell(reg.ticketId),
      fullName: sanitizeSpreadsheetCell(reg.fullName),
      phone: sanitizeSpreadsheetCell(formatIndianPhoneDisplay(reg.phone)),
      address: sanitizeSpreadsheetCell(reg.address),
      gender: sanitizeSpreadsheetCell(reg.gender),
      eventDate: reg.eventDate,
      seatNumber: reg.seatLabel,
      createdAt: reg.createdAt,
      checkInStatus: statusLabel,
    });
  }

  // Sheet 3 — Seat Map (Rows: Seat 001 to 150, Columns: all 9 dates)
  const seatSheet = workbook.addWorksheet('Seat Map', {
    views: [{ state: 'frozen', xSplit: 1, ySplit: 1 }],
  });

  seatSheet.columns = [
    { header: 'Seat', key: 'seat', width: 12 },
    ...targetDates.map((d) => ({
      header: `${d.dayAbbr} ${d.dateNumber} ${d.monthAbbr}`,
      key: d.id,
      width: 16,
    })),
  ];
  styleHeaderRow(seatSheet.getRow(1));

  const seatMapsByDate = new Map<string, Map<number, string>>();
  for (const d of targetDates) {
    const mapData = dbService.getAdminSeatMap(d.id);
    const cellMap = new Map<number, string>();
    if (mapData) {
      for (const cell of mapData.seats) {
        const label =
          cell.status === 'checked_in'
            ? 'CHECKED IN'
            : cell.status === 'booked'
              ? 'BOOKED'
              : 'FREE';
        cellMap.set(cell.seatNumber, label);
      }
    }
    seatMapsByDate.set(d.id, cellMap);
  }

  for (let seatNum = 1; seatNum <= FESTIVAL_INFO.capacityPerDate; seatNum++) {
    const rowObj: Record<string, string> = {
      seat: `Seat ${formatSeatNumber(seatNum)}`,
    };
    for (const d of targetDates) {
      rowObj[d.id] = seatMapsByDate.get(d.id)?.get(seatNum) ?? 'FREE';
    }
    seatSheet.addRow(rowObj);
  }

  // Sheet 4 — Festival Schedule
  const scheduleSheet = workbook.addWorksheet('Festival Schedule', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  scheduleSheet.columns = [
    { header: 'Day', key: 'day', width: 10 },
    { header: 'Event Date', key: 'eventDate', width: 15 },
    { header: 'Day Name', key: 'dayName', width: 14 },
    { header: 'Session Time', key: 'time', width: 22 },
    { header: 'Concert / Program', key: 'title', width: 44 },
    { header: 'Artists & Accompanists', key: 'performers', width: 58 },
  ];
  styleHeaderRow(scheduleSheet.getRow(1));

  for (const d of allDates) {
    for (const session of d.sessions) {
      scheduleSheet.addRow({
        day: `Day ${d.dayNumber}`,
        eventDate: d.eventDate,
        dayName: d.dayName,
        time: `${session.startTime} – ${session.endTime}`,
        title: sanitizeSpreadsheetCell(session.title),
        performers: sanitizeSpreadsheetCell(session.performers.join('; ')),
      });
    }
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
