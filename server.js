// server.ts
import "dotenv/config";
import express2 from "express";
import path2 from "node:path";
import { createServer as createViteServer } from "vite";

// src/server/app.ts
import cookieParser from "cookie-parser";
import express from "express";

// src/shared/validation.ts
import { z } from "zod";

// src/shared/seatAllocation.ts
function formatSeatNumber(seatNumber) {
  return String(seatNumber).padStart(3, "0");
}
function formatTicketId(eventDate, sequence) {
  const compactDate = eventDate.replace(/-/g, "");
  const seq = String(sequence).padStart(4, "0");
  return `MRG-${compactDate}-${seq}`;
}
function allocateSeatsForDates(selectedDateIds, occupiedSeatsByDate, capacityByDate, defaultCapacity = 150) {
  const uniqueDateIds = Array.from(new Set(selectedDateIds.filter(Boolean)));
  if (uniqueDateIds.length === 0) {
    return {
      ok: false,
      reason: "EMPTY_SELECTION",
      soldOutDateIds: [],
      message: "Please select at least one festival date."
    };
  }
  const soldOutDateIds = [];
  for (const dateId of uniqueDateIds) {
    const cap = capacityByDate?.get(dateId) ?? defaultCapacity;
    const occupied = occupiedSeatsByDate.get(dateId) ?? /* @__PURE__ */ new Set();
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
      reason: "SOLD_OUT",
      soldOutDateIds,
      message: "One or more selected festival dates are sold out."
    };
  }
  const minCommonCapacity = Math.min(
    ...uniqueDateIds.map((id) => capacityByDate?.get(id) ?? defaultCapacity)
  );
  let commonSeat = null;
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
      strategy: "common",
      assignments: uniqueDateIds.map((festivalDateId) => ({
        festivalDateId,
        seatNumber: commonSeat,
        seatLabel: formatSeatNumber(commonSeat)
      }))
    };
  }
  const assignments = uniqueDateIds.map((festivalDateId) => {
    const cap = capacityByDate?.get(festivalDateId) ?? defaultCapacity;
    const occupied = occupiedSeatsByDate.get(festivalDateId) ?? /* @__PURE__ */ new Set();
    for (let seat = 1; seat <= cap; seat++) {
      if (!occupied.has(seat)) {
        return {
          festivalDateId,
          seatNumber: seat,
          seatLabel: formatSeatNumber(seat)
        };
      }
    }
    throw new Error(`Invariant violation: no seat found for ${festivalDateId}`);
  });
  return {
    ok: true,
    strategy: "independent",
    assignments
  };
}
function normalizeIndianPhone(raw) {
  const digits = raw.replace(/[\s\-().+]/g, "");
  let national = digits;
  if (digits.length === 12 && digits.startsWith("91")) {
    national = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith("0")) {
    national = digits.slice(1);
  }
  if (/^[6-9]\d{9}$/.test(national)) {
    return national;
  }
  return null;
}
function formatIndianPhoneDisplay(phone) {
  const normalized = normalizeIndianPhone(phone);
  if (!normalized) return phone;
  return `+91 ${normalized.slice(0, 5)} ${normalized.slice(5)}`;
}
function sanitizeSpreadsheetCell(value) {
  if (value === null || value === void 0) return "";
  const str = String(value);
  if (str.length === 0) return "";
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

// src/shared/validation.ts
var GENDER_OPTIONS = [
  "Male",
  "Female",
  "Other",
  "Prefer not to say"
];
var CreateBookingSchema = z.object({
  fullName: z.string().trim().min(2, "Please enter your full name (at least 2 characters).").max(120, "Name must be under 120 characters."),
  phone: z.string().trim().refine((val) => normalizeIndianPhone(val) !== null, {
    message: "Please enter a valid 10-digit Indian mobile number (starting with 6\u20139)."
  }),
  address: z.string().trim().min(5, "Please enter your full residential address.").max(400, "Address must be under 400 characters."),
  gender: z.enum(GENDER_OPTIONS, {
    error: "Please select a gender option."
  }),
  consent: z.literal(true, {
    error: "You must agree to the registration consent statement."
  }),
  dateIds: z.array(z.string().min(1)).min(1, "Please select at least one festival date.").max(9, "Cannot select more than 9 festival dates."),
  idempotencyKey: z.string().trim().min(8, "Invalid submission key.").max(128, "Invalid submission key.")
});
var AdminLoginSchema = z.object({
  password: z.string().min(1, "Please enter the administrator password.")
});
var VerifyTicketSchema = z.object({
  ticketId: z.string().trim().min(1, "Ticket ID is required."),
  token: z.string().trim().min(1, "Verification token is required.")
});

// src/server/excelExport.ts
import ExcelJS from "exceljs";

// src/shared/festivalSchedule.ts
var FESTIVAL_INFO = {
  brand: "MARGAZHI",
  edition: "28th Annual December Music Festival 2026",
  organizer: "Sri Rama Bhaktha Jana Samaj",
  organizerAddress: "K.K. Nagar, Chennai \u2013 78",
  venue: "Avichi College of Arts and Science",
  venueAddress: "Arcot Road, Virugambakkam, Chennai \u2013 92",
  duration: "26 December 2026 \u2013 3 January 2027",
  capacityPerDate: 150,
  totalDates: 9
};
var FESTIVAL_DATES_SEED = [
  {
    id: "day-1-2026-12-26",
    dayNumber: 1,
    eventDate: "2026-12-26",
    dayName: "Saturday",
    dayAbbr: "SAT",
    dateNumber: "26",
    monthAbbr: "DEC",
    monthFull: "December",
    year: "2026",
    title: "Inauguration, Sangeetha Maamani Award & Violin Concert \u2014 Sangita Kalanidhi Kumari A. Kanyakumari",
    capacity: 150,
    sessions: [
      {
        id: "day-1-s1",
        startTime: "5:30 PM",
        endTime: "6:30 PM",
        title: "Inauguration & Sangeetha Maamani Award Presentation",
        performers: [
          "Inauguration and presentation of the Sangeetha Maamani Award to Sangita Kalanidhi Kumari A. Kanyakumari"
        ],
        displayOrder: 1
      },
      {
        id: "day-1-s2",
        startTime: "6:30 PM",
        endTime: "9:00 PM",
        title: "Violin Concert \u2014 Sangita Kalanidhi Kumari A. Kanyakumari",
        performers: [
          "Sangita Kalanidhi Kumari A. Kanyakumari \u2014 Violin",
          "M. Rajeev \u2014 Violin Support",
          "K. V. Prasad \u2014 Mridangam",
          "Vaikom R. Gopalakrishnan \u2014 Ghatam"
        ],
        displayOrder: 2
      }
    ]
  },
  {
    id: "day-2-2026-12-27",
    dayNumber: 2,
    eventDate: "2026-12-27",
    dayName: "Sunday",
    dayAbbr: "SUN",
    dateNumber: "27",
    monthAbbr: "DEC",
    monthFull: "December",
    year: "2026",
    title: "Young Talent Concert & Veena Concert \u2014 Rajhesh Vaidhya & Party",
    capacity: 150,
    sessions: [
      {
        id: "day-2-s1",
        startTime: "4:30 PM",
        endTime: "6:15 PM",
        title: "Young Talent Concert",
        performers: [
          "Shreya Sundararaman \u2014 Vocal",
          "Prithvi Bhaskar \u2014 Violin",
          "Ajeet Sridhar \u2014 Mridangam"
        ],
        displayOrder: 1
      },
      {
        id: "day-2-s2",
        startTime: "6:30 PM",
        endTime: "9:00 PM",
        title: "Veena Concert \u2014 Rajhesh Vaidhya & Party",
        performers: ["Rajhesh Vaidhya & Party \u2014 Veena"],
        displayOrder: 2
      }
    ]
  },
  {
    id: "day-3-2026-12-28",
    dayNumber: 3,
    eventDate: "2026-12-28",
    dayName: "Monday",
    dayAbbr: "MON",
    dateNumber: "28",
    monthAbbr: "DEC",
    monthFull: "December",
    year: "2026",
    title: "Vocal Concert \u2014 K. S. Vishnudev",
    capacity: 150,
    sessions: [
      {
        id: "day-3-s1",
        startTime: "6:30 PM",
        endTime: "9:00 PM",
        title: "K. S. Vishnudev \u2014 Vocal",
        performers: [
          "K. S. Vishnudev \u2014 Vocal",
          "Alankode Gokul \u2014 Violin",
          "Praveen Sparsh \u2014 Mridangam",
          "Payyannur Govinda Prasad \u2014 Morsing"
        ],
        displayOrder: 1
      }
    ]
  },
  {
    id: "day-4-2026-12-29",
    dayNumber: 4,
    eventDate: "2026-12-29",
    dayName: "Tuesday",
    dayAbbr: "TUE",
    dateNumber: "29",
    monthAbbr: "DEC",
    monthFull: "December",
    year: "2026",
    title: "Vocal Concert \u2014 Dr. N. J. Nandini",
    capacity: 150,
    sessions: [
      {
        id: "day-4-s1",
        startTime: "6:30 PM",
        endTime: "9:00 PM",
        title: "Dr. N. J. Nandini \u2014 Vocal",
        performers: [
          "Dr. N. J. Nandini \u2014 Vocal",
          "Alankode Gokul \u2014 Violin",
          "Aduthurai Guruprasad \u2014 Mridangam",
          "Udupi Srikanth \u2014 Khanjira"
        ],
        displayOrder: 1
      }
    ]
  },
  {
    id: "day-5-2026-12-30",
    dayNumber: 5,
    eventDate: "2026-12-30",
    dayName: "Wednesday",
    dayAbbr: "WED",
    dateNumber: "30",
    monthAbbr: "DEC",
    monthFull: "December",
    year: "2026",
    title: "Flute Concert \u2014 Jayanth",
    capacity: 150,
    sessions: [
      {
        id: "day-5-s1",
        startTime: "6:30 PM",
        endTime: "9:00 PM",
        title: "Jayanth \u2014 Flute",
        performers: [
          "Jayanth \u2014 Flute",
          "Kamalakiran \u2014 Violin",
          "Srimushnam Rajarao \u2014 Mridangam",
          "S. V. Ramani \u2014 Gadam"
        ],
        displayOrder: 1
      }
    ]
  },
  {
    id: "day-6-2026-12-31",
    dayNumber: 6,
    eventDate: "2026-12-31",
    dayName: "Thursday",
    dayAbbr: "THU",
    dateNumber: "31",
    monthAbbr: "DEC",
    monthFull: "December",
    year: "2026",
    title: "Vocal Concert \u2014 Cherthala Dr. K. N. Ranganatha Sharma",
    capacity: 150,
    sessions: [
      {
        id: "day-6-s1",
        startTime: "6:30 PM",
        endTime: "9:00 PM",
        title: "Cherthala Dr. K. N. Ranganatha Sharma \u2014 Vocal",
        performers: [
          "Cherthala Dr. K. N. Ranganatha Sharma \u2014 Vocal",
          "Vittal Ramamurthy \u2014 Violin",
          "Mannargudi A. Eswaran \u2014 Mridangam",
          "Vellattanjur Sreejith \u2014 Gadam"
        ],
        displayOrder: 1
      }
    ]
  },
  {
    id: "day-7-2027-01-01",
    dayNumber: 7,
    eventDate: "2027-01-01",
    dayName: "Friday",
    dayAbbr: "FRI",
    dateNumber: "1",
    monthAbbr: "JAN",
    monthFull: "January",
    year: "2027",
    title: "Couple Vocal \u2014 Barghav S. Hariharan & Krupaalakshmi",
    capacity: 150,
    sessions: [
      {
        id: "day-7-s1",
        startTime: "6:30 PM",
        endTime: "9:00 PM",
        title: "Barghav S. Hariharan & Krupaalakshmi \u2014 Couple Vocal",
        performers: [
          "Barghav S. Hariharan & Krupaalakshmi \u2014 Couple Vocal",
          "M. Vijai \u2014 Violin",
          "K. V. Prasad \u2014 Mridangam",
          "Vazhappally Krishnakumar \u2014 Gadam"
        ],
        displayOrder: 1
      }
    ]
  },
  {
    id: "day-8-2027-01-02",
    dayNumber: 8,
    eventDate: "2027-01-02",
    dayName: "Saturday",
    dayAbbr: "SAT",
    dateNumber: "2",
    monthAbbr: "JAN",
    monthFull: "January",
    year: "2027",
    title: "Vocal Concerts \u2014 R. P. Shravan & K. Gayatri",
    capacity: 150,
    sessions: [
      {
        id: "day-8-s1",
        startTime: "4:30 PM",
        endTime: "6:15 PM",
        title: "R. P. Shravan \u2014 Vocal",
        performers: [
          "R. P. Shravan \u2014 Vocal",
          "M. Vijai \u2014 Violin",
          "Puttur Nikshith \u2014 Mridangam"
        ],
        displayOrder: 1
      },
      {
        id: "day-8-s2",
        startTime: "6:30 PM",
        endTime: "9:00 PM",
        title: "K. Gayatri \u2014 Vocal",
        performers: ["K. Gayatri \u2014 Vocal"],
        displayOrder: 2
      }
    ]
  },
  {
    id: "day-9-2027-01-03",
    dayNumber: 9,
    eventDate: "2027-01-03",
    dayName: "Sunday",
    dayAbbr: "SUN",
    dateNumber: "3",
    monthAbbr: "JAN",
    monthFull: "January",
    year: "2027",
    title: "Vocal Concert & Namasankeerthanam \u2014 Finale",
    capacity: 150,
    sessions: [
      {
        id: "day-9-s1",
        startTime: "4:30 PM",
        endTime: "6:15 PM",
        title: "Kausthub P. Chandramouli & Party \u2014 Vocal",
        performers: ["Kausthub P. Chandramouli & Party \u2014 Vocal"],
        displayOrder: 1
      },
      {
        id: "day-9-s2",
        startTime: "6:30 PM",
        endTime: "9:00 PM",
        title: "Namasankeerthanam by Melakode Ravi Bhagavathar & Party",
        performers: ["Melakode Ravi Bhagavathar & Party \u2014 Namasankeerthanam"],
        displayOrder: 2
      }
    ]
  }
];

// src/server/excelExport.ts
var HEADER_FILL = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF242424" }
};
var HEADER_FONT = {
  bold: true,
  color: { argb: "FFFAF8F4" },
  size: 11
};
function styleHeaderRow(row) {
  row.height = 24;
  row.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: "middle", horizontal: "left" };
    cell.border = {
      bottom: { style: "thin", color: { argb: "FFB49A6C" } }
    };
  });
}
async function generateFestivalWorkbook(dbService, options) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = FESTIVAL_INFO.organizer;
  workbook.created = /* @__PURE__ */ new Date();
  const allDates = dbService.getFestivalDates();
  const targetDates = options?.dateId && options.dateId !== "all" ? allDates.filter((d) => d.id === options.dateId) : allDates;
  const registrations = dbService.getAdminRegistrations(
    options?.dateId && options.dateId !== "all" ? { dateId: options.dateId } : void 0
  );
  const dashboardSheet = workbook.addWorksheet("Dashboard", {
    views: [{ state: "frozen", ySplit: 1 }]
  });
  dashboardSheet.columns = [
    { header: "Event Date", key: "eventDate", width: 15 },
    { header: "Day", key: "dayName", width: 14 },
    { header: "Concert", key: "concert", width: 52 },
    { header: "Total Seats", key: "totalSeats", width: 14 },
    { header: "Registered Seats", key: "registeredSeats", width: 18 },
    { header: "Remaining Seats", key: "remainingSeats", width: 18 },
    { header: "Check-ins", key: "checkIns", width: 14 },
    { header: "Occupancy Percentage", key: "occupancyPct", width: 22 }
  ];
  styleHeaderRow(dashboardSheet.getRow(1));
  dashboardSheet.autoFilter = {
    from: "A1",
    to: "H1"
  };
  for (const d of targetDates) {
    const pct = d.capacity > 0 ? (d.bookedCount / d.capacity * 100).toFixed(1) + "%" : "0.0%";
    dashboardSheet.addRow({
      eventDate: d.eventDate,
      dayName: d.dayName,
      concert: sanitizeSpreadsheetCell(d.title),
      totalSeats: d.capacity,
      registeredSeats: d.bookedCount,
      remainingSeats: d.remainingSeats,
      checkIns: d.checkedInCount,
      occupancyPct: pct
    });
  }
  const regSheet = workbook.addWorksheet("Registrations", {
    views: [{ state: "frozen", ySplit: 1 }]
  });
  regSheet.columns = [
    { header: "Booking ID", key: "bookingId", width: 18 },
    { header: "Ticket ID", key: "ticketId", width: 22 },
    { header: "Full Name", key: "fullName", width: 26 },
    { header: "Phone Number", key: "phone", width: 18 },
    { header: "Address", key: "address", width: 38 },
    { header: "Gender", key: "gender", width: 18 },
    { header: "Event Date", key: "eventDate", width: 15 },
    { header: "Seat Number", key: "seatNumber", width: 14 },
    { header: "Registration Date and Time", key: "createdAt", width: 26 },
    { header: "Check-in Status", key: "checkInStatus", width: 18 }
  ];
  styleHeaderRow(regSheet.getRow(1));
  regSheet.autoFilter = {
    from: "A1",
    to: "J1"
  };
  for (const reg of registrations) {
    const statusLabel = reg.ticketStatus === "checked_in" ? "CHECKED IN" : reg.ticketStatus === "cancelled" ? "CANCELLED" : "CONFIRMED";
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
      checkInStatus: statusLabel
    });
  }
  const seatSheet = workbook.addWorksheet("Seat Map", {
    views: [{ state: "frozen", xSplit: 1, ySplit: 1 }]
  });
  seatSheet.columns = [
    { header: "Seat", key: "seat", width: 12 },
    ...targetDates.map((d) => ({
      header: `${d.dayAbbr} ${d.dateNumber} ${d.monthAbbr}`,
      key: d.id,
      width: 16
    }))
  ];
  styleHeaderRow(seatSheet.getRow(1));
  const seatMapsByDate = /* @__PURE__ */ new Map();
  for (const d of targetDates) {
    const mapData = dbService.getAdminSeatMap(d.id);
    const cellMap = /* @__PURE__ */ new Map();
    if (mapData) {
      for (const cell of mapData.seats) {
        const label = cell.status === "checked_in" ? "CHECKED IN" : cell.status === "booked" ? "BOOKED" : "FREE";
        cellMap.set(cell.seatNumber, label);
      }
    }
    seatMapsByDate.set(d.id, cellMap);
  }
  for (let seatNum = 1; seatNum <= FESTIVAL_INFO.capacityPerDate; seatNum++) {
    const rowObj = {
      seat: `Seat ${formatSeatNumber(seatNum)}`
    };
    for (const d of targetDates) {
      rowObj[d.id] = seatMapsByDate.get(d.id)?.get(seatNum) ?? "FREE";
    }
    seatSheet.addRow(rowObj);
  }
  const scheduleSheet = workbook.addWorksheet("Festival Schedule", {
    views: [{ state: "frozen", ySplit: 1 }]
  });
  scheduleSheet.columns = [
    { header: "Day", key: "day", width: 10 },
    { header: "Event Date", key: "eventDate", width: 15 },
    { header: "Day Name", key: "dayName", width: 14 },
    { header: "Session Time", key: "time", width: 22 },
    { header: "Concert / Program", key: "title", width: 44 },
    { header: "Artists & Accompanists", key: "performers", width: 58 }
  ];
  styleHeaderRow(scheduleSheet.getRow(1));
  for (const d of allDates) {
    for (const session of d.sessions) {
      scheduleSheet.addRow({
        day: `Day ${d.dayNumber}`,
        eventDate: d.eventDate,
        dayName: d.dayName,
        time: `${session.startTime} \u2013 ${session.endTime}`,
        title: sanitizeSpreadsheetCell(session.title),
        performers: sanitizeSpreadsheetCell(session.performers.join("; "))
      });
    }
  }
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

// src/server/security.ts
import crypto from "node:crypto";
var COOKIE_NAME = "margazhi_admin_session";
var SESSION_TTL_MS = 8 * 60 * 60 * 1e3;
var EPHEMERAL_DEV_SECRET = crypto.randomBytes(32).toString("hex");
function getSessionSecret() {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16) {
    return process.env.SESSION_SECRET;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET environment variable must be configured in production.");
  }
  return process.env.SESSION_SECRET || EPHEMERAL_DEV_SECRET;
}
function getAdminPassword() {
  if (process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.length > 0) {
    return process.env.ADMIN_PASSWORD;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("ADMIN_PASSWORD environment variable must be configured in production.");
  }
  return "margazhi2026";
}
function verifyAdminPassword(candidate) {
  const expected = getAdminPassword();
  const candidateHash = crypto.createHash("sha256").update(candidate).digest();
  const expectedHash = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(candidateHash, expectedHash);
}
function createSessionToken() {
  const payload = Buffer.from(
    JSON.stringify({
      role: "admin",
      iat: Date.now(),
      exp: Date.now() + SESSION_TTL_MS,
      nonce: crypto.randomBytes(8).toString("hex")
    })
  ).toString("base64url");
  const sig = crypto.createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}
function verifySessionToken(token) {
  if (!token || !token.includes(".")) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payload, sig] = parts;
  const expectedSig = crypto.createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length) return false;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return false;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (parsed.role !== "admin") return false;
    if (!parsed.exp || Date.now() > parsed.exp) return false;
    return true;
  } catch {
    return false;
  }
}
function setAdminSessionCookie(res, token, req) {
  const isHttps = req.secure || req.headers["x-forwarded-proto"] === "https" || process.env.NODE_ENV === "production";
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isHttps,
    maxAge: SESSION_TTL_MS,
    path: "/"
  });
}
function clearAdminSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite: "lax",
    path: "/"
  });
}
function isAdminAuthenticated(req) {
  const token = req.cookies?.[COOKIE_NAME];
  return verifySessionToken(token);
}
function generateVerificationTokenPair() {
  const rawToken = crypto.randomBytes(24).toString("base64url");
  const tokenHash = hashVerificationToken(rawToken);
  return { rawToken, tokenHash };
}
function hashVerificationToken(rawToken) {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}
function createBookingAccessToken(bookingId) {
  const sig = crypto.createHmac("sha256", getSessionSecret()).update(`booking:${bookingId}`).digest("base64url");
  return sig;
}
function verifyBookingAccessToken(bookingId, token) {
  if (!token) return false;
  const expected = createBookingAccessToken(bookingId);
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
var rateLimitBuckets = /* @__PURE__ */ new Map();
function checkRateLimit(key, maxRequests, windowMs) {
  const now = Date.now();
  const windowStart = now - windowMs;
  const timestamps = (rateLimitBuckets.get(key) ?? []).filter((t) => t > windowStart);
  if (timestamps.length >= maxRequests) {
    const oldest = timestamps[0] ?? now;
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1e3));
    rateLimitBuckets.set(key, timestamps);
    return { allowed: false, retryAfterSeconds };
  }
  timestamps.push(now);
  rateLimitBuckets.set(key, timestamps);
  return { allowed: true, retryAfterSeconds: 0 };
}

// src/server/app.ts
function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || "unknown";
}
function createApiApp(dbService, options = {}) {
  const app = express();
  app.use(express.json({ limit: "64kb" }));
  app.use(cookieParser());
  function requireAdmin(req, res, next) {
    if (!isAdminAuthenticated(req)) {
      return res.status(401).json({ error: "Administrator authentication required." });
    }
    return next();
  }
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, service: "MARGAZHI" });
  });
  app.get("/api/dates", (_req, res) => {
    try {
      const dates = dbService.getFestivalDates();
      res.json({ dates });
    } catch (error) {
      console.error("Error fetching festival dates:", error);
      res.status(500).json({ error: "Unable to load festival schedule." });
    }
  });
  app.post("/api/bookings", (req, res) => {
    if (!options.disableRateLimit) {
      const ip = getClientIp(req);
      const rl = checkRateLimit(`book:${ip}`, 30, 15 * 60 * 1e3);
      if (!rl.allowed) {
        res.setHeader("Retry-After", String(rl.retryAfterSeconds));
        return res.status(429).json({
          error: "Too many booking attempts. Please wait a moment and try again."
        });
      }
    }
    const parsed = CreateBookingSchema.safeParse(req.body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return res.status(400).json({
        error: firstIssue?.message ?? "Invalid registration details.",
        fieldErrors: parsed.error.flatten().fieldErrors
      });
    }
    const result = dbService.createBooking(parsed.data);
    if (!result.ok) {
      return res.status(result.statusCode).json({
        error: result.error,
        soldOutDateIds: result.soldOutDateIds ?? []
      });
    }
    return res.status(result.duplicateIdempotent ? 200 : 201).json({
      booking: result.confirmation,
      duplicateIdempotent: result.duplicateIdempotent
    });
  });
  app.get("/api/bookings/:bookingId", (req, res) => {
    const { bookingId } = req.params;
    const accessToken = typeof req.query.access === "string" ? req.query.access : void 0;
    const isAdmin = isAdminAuthenticated(req);
    if (!isAdmin && !verifyBookingAccessToken(bookingId, accessToken)) {
      return res.status(403).json({ error: "Invalid or missing booking access token." });
    }
    const confirmation = dbService.getBookingConfirmation(bookingId, accessToken, isAdmin);
    if (!confirmation) {
      return res.status(404).json({ error: "Booking not found." });
    }
    return res.json({ booking: confirmation });
  });
  app.get("/api/tickets/:ticketId", (req, res) => {
    const { ticketId } = req.params;
    const token = typeof req.query.token === "string" ? req.query.token : void 0;
    const isAdmin = isAdminAuthenticated(req);
    const ticket = dbService.getTicketById(ticketId, token, isAdmin);
    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found or verification token invalid." });
    }
    return res.json({ ticket });
  });
  app.post("/api/verify/inspect", (req, res) => {
    const parsed = VerifyTicketSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Ticket ID and verification token are required." });
    }
    const isStaff = isAdminAuthenticated(req);
    const referenceDate = typeof req.body.referenceDate === "string" && req.body.referenceDate.length === 10 ? req.body.referenceDate : void 0;
    const result = dbService.inspectTicket(
      parsed.data.ticketId,
      parsed.data.token,
      isStaff,
      referenceDate
    );
    return res.json(result);
  });
  app.post("/api/verify/checkin", requireAdmin, (req, res) => {
    const parsed = VerifyTicketSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Ticket ID and verification token are required." });
    }
    const result = dbService.checkInTicket(parsed.data.ticketId, parsed.data.token, true);
    return res.json(result);
  });
  app.post("/api/admin/login", (req, res) => {
    if (!options.disableRateLimit) {
      const ip = getClientIp(req);
      const rl = checkRateLimit(`admin-login:${ip}`, 10, 15 * 60 * 1e3);
      if (!rl.allowed) {
        res.setHeader("Retry-After", String(rl.retryAfterSeconds));
        return res.status(429).json({
          error: "Too many login attempts. Please try again in a few minutes."
        });
      }
    }
    const parsed = AdminLoginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Please enter the administrator password." });
    }
    if (!verifyAdminPassword(parsed.data.password)) {
      dbService.recordAuditLog("ADMIN_LOGIN_FAILED", null, { ip: getClientIp(req) });
      return res.status(401).json({ error: "Invalid administrator password." });
    }
    const token = createSessionToken();
    setAdminSessionCookie(res, token, req);
    dbService.recordAuditLog("ADMIN_LOGIN_SUCCESS", null, {});
    return res.json({ authenticated: true });
  });
  app.post("/api/admin/logout", (req, res) => {
    clearAdminSessionCookie(res);
    return res.json({ authenticated: false });
  });
  app.get("/api/admin/session", (req, res) => {
    return res.json({ authenticated: isAdminAuthenticated(req) });
  });
  app.get("/api/admin/overview", requireAdmin, (_req, res) => {
    const overview = dbService.getAdminOverview();
    res.json(overview);
  });
  app.get("/api/admin/registrations", requireAdmin, (req, res) => {
    const registrations = dbService.getAdminRegistrations({
      dateId: typeof req.query.dateId === "string" ? req.query.dateId : void 0,
      search: typeof req.query.search === "string" ? req.query.search : void 0,
      checkInStatus: typeof req.query.checkInStatus === "string" ? req.query.checkInStatus : void 0,
      registrationDate: typeof req.query.registrationDate === "string" ? req.query.registrationDate : void 0
    });
    res.json({ registrations });
  });
  app.get("/api/admin/seats/:dateId", requireAdmin, (req, res) => {
    const mapData = dbService.getAdminSeatMap(req.params.dateId);
    if (!mapData) {
      return res.status(404).json({ error: "Festival date not found." });
    }
    return res.json(mapData);
  });
  app.post("/api/admin/tickets/:ticketId/checkin", requireAdmin, (req, res) => {
    const result = dbService.checkInTicket(req.params.ticketId, void 0, false);
    if (result.verificationStatus === "invalid") {
      return res.status(404).json(result);
    }
    return res.json(result);
  });
  app.post("/api/admin/tickets/:ticketId/cancel", requireAdmin, (req, res) => {
    const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : void 0;
    const result = dbService.cancelTicket(req.params.ticketId, reason);
    if (!result.ok) {
      return res.status(400).json({ error: result.error });
    }
    return res.json({ ok: true });
  });
  app.patch("/api/admin/dates/:dateId", requireAdmin, (req, res) => {
    const status = req.body?.bookingStatus;
    if (status !== "open" && status !== "closed") {
      return res.status(400).json({ error: "Invalid booking status." });
    }
    const ok = dbService.updateDateBookingStatus(req.params.dateId, status);
    if (!ok) {
      return res.status(404).json({ error: "Festival date not found." });
    }
    return res.json({ ok: true, bookingStatus: status });
  });
  app.get("/api/admin/audit-logs", requireAdmin, (_req, res) => {
    const logs = dbService.getAuditLogs(100);
    res.json({ logs });
  });
  app.get("/api/admin/export", requireAdmin, async (req, res) => {
    try {
      const dateId = typeof req.query.dateId === "string" ? req.query.dateId : void 0;
      const buffer = await generateFestivalWorkbook(dbService, { dateId });
      dbService.recordAuditLog("EXCEL_EXPORT", dateId ?? "all", {});
      const suffix = dateId && dateId !== "all" ? dateId : "full-festival";
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="margazhi-2026-${suffix}.xlsx"`
      );
      res.send(buffer);
    } catch (error) {
      console.error("Excel export failed:", error);
      res.status(500).json({ error: "Failed to generate Excel report." });
    }
  });
  return app;
}

// src/server/db.ts
import Database from "better-sqlite3";
import crypto2 from "node:crypto";
import fs from "node:fs";
import path from "node:path";
function createDatabaseService(dbFilePath) {
  const resolvedPath = dbFilePath ?? path.resolve(process.cwd(), "data", "margazhi.db");
  if (resolvedPath !== ":memory:") {
    fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  }
  const db = new Database(resolvedPath);
  db.pragma("foreign_keys = ON");
  if (resolvedPath !== ":memory:") {
    db.pragma("journal_mode = WAL");
  }
  db.pragma("busy_timeout = 5000");
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
        capacity: dateSeed.capacity
      });
      for (const session of dateSeed.sessions) {
        insertSession.run({
          id: session.id,
          festivalDateId: dateSeed.id,
          startTime: session.startTime,
          endTime: session.endTime,
          title: session.title,
          performersJson: JSON.stringify(session.performers),
          displayOrder: session.displayOrder
        });
      }
    }
  });
  seedTx();
  function getSessionsByDateMap() {
    const rows = db.prepare(
      `SELECT id, festival_date_id, start_time, end_time, title, performers_json, display_order
         FROM concert_sessions
         ORDER BY display_order ASC`
    ).all();
    const map = /* @__PURE__ */ new Map();
    for (const row of rows) {
      const list = map.get(row.festival_date_id) ?? [];
      list.push({
        id: row.id,
        festivalDateId: row.festival_date_id,
        startTime: row.start_time,
        endTime: row.end_time,
        title: row.title,
        performers: JSON.parse(row.performers_json),
        displayOrder: row.display_order
      });
      map.set(row.festival_date_id, list);
    }
    return map;
  }
  function getFestivalDates() {
    const sessionsMap = getSessionsByDateMap();
    const rows = db.prepare(
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
    ).all();
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
      sessions: sessionsMap.get(r.id) ?? []
    }));
  }
  function buildPublicTicketsForBooking(bookingId, rawTokensByTicketId) {
    const sessionsMap = getSessionsByDateMap();
    const rows = db.prepare(
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
    ).all(bookingId);
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
      verificationToken: rawTokensByTicketId?.get(r.id)
    }));
  }
  function createBooking(input, options) {
    const normalizedPhone = normalizeIndianPhone(input.phone);
    if (!normalizedPhone) {
      return {
        ok: false,
        statusCode: 400,
        error: "Please enter a valid 10-digit Indian mobile number."
      };
    }
    const uniqueDateIds = Array.from(new Set(input.dateIds));
    if (uniqueDateIds.length === 0) {
      return {
        ok: false,
        statusCode: 400,
        error: "Please select at least one festival date."
      };
    }
    const rawTokensByTicketId = /* @__PURE__ */ new Map();
    let strategy = "common";
    let bookingId = "";
    let createdAt = "";
    let duplicateIdempotent = false;
    const runBookingTx = db.transaction(() => {
      const existingBooking = db.prepare(`SELECT id, attendee_name, created_at FROM bookings WHERE idempotency_key = ?`).get(input.idempotencyKey);
      if (existingBooking) {
        duplicateIdempotent = true;
        bookingId = existingBooking.id;
        createdAt = existingBooking.created_at;
        const existingTokens = db.prepare(`SELECT id, verification_token_enc FROM tickets WHERE booking_id = ?`).all(existingBooking.id);
        for (const t of existingTokens) {
          if (t.verification_token_enc) {
            rawTokensByTicketId.set(t.id, t.verification_token_enc);
          }
        }
        return;
      }
      const placeholders = uniqueDateIds.map(() => "?").join(",");
      const dateRows = db.prepare(
        `SELECT id, event_date, capacity, booking_status, day_number
           FROM festival_dates
           WHERE id IN (${placeholders})
           ORDER BY day_number ASC`
      ).all(...uniqueDateIds);
      if (dateRows.length !== uniqueDateIds.length) {
        throw Object.assign(new Error("One or more selected festival dates are invalid."), {
          statusCode: 400
        });
      }
      const closedDates = dateRows.filter((d) => d.booking_status !== "open");
      if (closedDates.length > 0) {
        throw Object.assign(new Error("Booking is currently closed for one or more selected dates."), {
          statusCode: 400
        });
      }
      const orderedDateIds = dateRows.map((d) => d.id);
      const capacityByDate = /* @__PURE__ */ new Map();
      const eventDateById = /* @__PURE__ */ new Map();
      for (const d of dateRows) {
        capacityByDate.set(d.id, d.capacity);
        eventDateById.set(d.id, d.event_date);
      }
      const occupiedRows = db.prepare(
        `SELECT festival_date_id, seat_number
           FROM tickets
           WHERE festival_date_id IN (${placeholders})
             AND status != 'cancelled'`
      ).all(...orderedDateIds);
      const occupiedSeatsByDate = /* @__PURE__ */ new Map();
      for (const dId of orderedDateIds) {
        occupiedSeatsByDate.set(dId, /* @__PURE__ */ new Set());
      }
      for (const row of occupiedRows) {
        occupiedSeatsByDate.get(row.festival_date_id).add(row.seat_number);
      }
      const allocation = allocateSeatsForDates(orderedDateIds, occupiedSeatsByDate, capacityByDate);
      if (!allocation.ok) {
        throw Object.assign(new Error(allocation.message), {
          statusCode: allocation.reason === "SOLD_OUT" ? 409 : 400,
          soldOutDateIds: allocation.soldOutDateIds
        });
      }
      strategy = allocation.strategy;
      bookingId = `BK-${crypto2.randomBytes(5).toString("hex").toUpperCase()}`;
      createdAt = (/* @__PURE__ */ new Date()).toISOString();
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
        const eventDate = eventDateById.get(assign.festivalDateId);
        const existingCount = countStmt.get(assign.festivalDateId).total;
        let seq = existingCount + 1;
        let ticketId = formatTicketId(eventDate, seq);
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
      runBookingTx.immediate();
    } catch (err) {
      const e = err;
      return {
        ok: false,
        statusCode: e.statusCode ?? 500,
        error: e.message ?? "Could not complete booking due to a server error.",
        soldOutDateIds: e.soldOutDateIds
      };
    }
    const tickets = buildPublicTicketsForBooking(bookingId, rawTokensByTicketId);
    const accessToken = createBookingAccessToken(bookingId);
    return {
      ok: true,
      duplicateIdempotent,
      confirmation: {
        bookingId,
        accessToken,
        attendeeName: tickets[0]?.attendeeName ?? input.fullName.trim(),
        strategy,
        createdAt,
        tickets
      }
    };
  }
  function getBookingConfirmation(bookingId, accessToken, isAdmin) {
    if (!isAdmin) {
      if (!accessToken || accessToken !== createBookingAccessToken(bookingId)) {
        return null;
      }
    }
    const booking = db.prepare(`SELECT id, attendee_name, created_at FROM bookings WHERE id = ?`).get(bookingId);
    if (!booking) return null;
    const tokenRows = db.prepare(`SELECT id, verification_token_enc FROM tickets WHERE booking_id = ?`).all(bookingId);
    const rawTokens = /* @__PURE__ */ new Map();
    for (const r of tokenRows) {
      if (r.verification_token_enc) rawTokens.set(r.id, r.verification_token_enc);
    }
    const tickets = buildPublicTicketsForBooking(bookingId, rawTokens);
    const uniqueSeats = new Set(tickets.map((t) => t.seatNumber));
    return {
      bookingId: booking.id,
      accessToken: createBookingAccessToken(booking.id),
      attendeeName: booking.attendee_name,
      strategy: uniqueSeats.size <= 1 ? "common" : "independent",
      createdAt: booking.created_at,
      tickets
    };
  }
  function getTicketById(ticketId, rawToken, isAdmin) {
    const row = db.prepare(
      `SELECT t.id, t.booking_id, t.verification_token_hash, t.verification_token_enc
         FROM tickets t
         WHERE t.id = ?`
    ).get(ticketId);
    if (!row) return null;
    if (!isAdmin) {
      if (!rawToken) return null;
      const incomingHash = hashVerificationToken(rawToken);
      const a = Buffer.from(incomingHash);
      const b = Buffer.from(row.verification_token_hash);
      if (a.length !== b.length || !crypto2.timingSafeEqual(a, b)) {
        return null;
      }
    }
    const tokens = /* @__PURE__ */ new Map();
    if (rawToken) {
      tokens.set(row.id, rawToken);
    } else if (isAdmin && row.verification_token_enc) {
      tokens.set(row.id, row.verification_token_enc);
    }
    const allTickets = buildPublicTicketsForBooking(row.booking_id, tokens);
    return allTickets.find((t) => t.id === ticketId) ?? null;
  }
  function inspectTicket(ticketId, rawToken, isStaffAuthenticated, referenceDate) {
    const row = db.prepare(
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
    ).get(ticketId.trim());
    if (!row) {
      return {
        verificationStatus: "invalid",
        message: "Ticket not found or verification code is invalid.",
        ticketId: null,
        eventDate: null,
        dayName: null,
        dateTitle: null,
        seatLabel: null,
        checkedInAt: null,
        attendeeName: null,
        isStaffAuthenticated
      };
    }
    const incomingHash = hashVerificationToken(rawToken.trim());
    const a = Buffer.from(incomingHash);
    const b = Buffer.from(row.verification_token_hash);
    if (a.length !== b.length || !crypto2.timingSafeEqual(a, b)) {
      return {
        verificationStatus: "invalid",
        message: "Ticket verification signature does not match.",
        ticketId: null,
        eventDate: null,
        dayName: null,
        dateTitle: null,
        seatLabel: null,
        checkedInAt: null,
        attendeeName: null,
        isStaffAuthenticated
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
      isStaffAuthenticated
    };
    if (row.status === "cancelled") {
      return {
        ...basePayload,
        verificationStatus: "cancelled",
        message: "This ticket reservation has been cancelled."
      };
    }
    if (row.status === "checked_in" || row.checked_in_at !== null) {
      return {
        ...basePayload,
        verificationStatus: "already_checked_in",
        message: "This ticket has already been checked in."
      };
    }
    if (referenceDate && referenceDate !== row.event_date) {
      return {
        ...basePayload,
        verificationStatus: "wrong_event_date",
        message: `Valid ticket, but scheduled for ${row.day_name}, ${row.event_date} rather than ${referenceDate}.`
      };
    }
    return {
      ...basePayload,
      verificationStatus: "valid",
      message: "Valid MARGAZHI ticket ready for admission."
    };
  }
  function checkInTicket(ticketId, rawToken, requireTokenMatch = false) {
    let result;
    const tx = db.transaction(() => {
      const row = db.prepare(
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
      ).get(ticketId.trim());
      if (!row) {
        result = {
          verificationStatus: "invalid",
          message: "Ticket not found.",
          ticketId: null,
          eventDate: null,
          dayName: null,
          dateTitle: null,
          seatLabel: null,
          checkedInAt: null,
          attendeeName: null,
          isStaffAuthenticated: true
        };
        return;
      }
      if (requireTokenMatch) {
        const incomingHash = hashVerificationToken((rawToken ?? "").trim());
        const a = Buffer.from(incomingHash);
        const b = Buffer.from(row.verification_token_hash);
        if (a.length !== b.length || !crypto2.timingSafeEqual(a, b)) {
          result = {
            verificationStatus: "invalid",
            message: "Ticket verification signature does not match.",
            ticketId: null,
            eventDate: null,
            dayName: null,
            dateTitle: null,
            seatLabel: null,
            checkedInAt: null,
            attendeeName: null,
            isStaffAuthenticated: true
          };
          return;
        }
      }
      if (row.status === "cancelled") {
        result = {
          verificationStatus: "cancelled",
          message: "Cannot check in a cancelled ticket.",
          ticketId: row.id,
          eventDate: row.event_date,
          dayName: row.day_name,
          dateTitle: row.date_title,
          seatLabel: formatSeatNumber(row.seat_number),
          checkedInAt: null,
          attendeeName: row.attendee_name,
          isStaffAuthenticated: true
        };
        return;
      }
      const nowIso = (/* @__PURE__ */ new Date()).toISOString();
      const updateInfo = db.prepare(
        `UPDATE tickets
           SET status = 'checked_in', checked_in_at = ?
           WHERE id = ? AND status = 'confirmed' AND checked_in_at IS NULL`
      ).run(nowIso, row.id);
      if (updateInfo.changes === 0) {
        result = {
          verificationStatus: "already_checked_in",
          message: "Ticket was already checked in.",
          ticketId: row.id,
          eventDate: row.event_date,
          dayName: row.day_name,
          dateTitle: row.date_title,
          seatLabel: formatSeatNumber(row.seat_number),
          checkedInAt: row.checked_in_at,
          attendeeName: row.attendee_name,
          isStaffAuthenticated: true
        };
        return;
      }
      recordAuditLog("TICKET_CHECKIN", row.id, {
        eventDate: row.event_date,
        seatNumber: row.seat_number
      });
      result = {
        verificationStatus: "valid",
        message: "Check-in confirmed. Welcome to MARGAZHI.",
        ticketId: row.id,
        eventDate: row.event_date,
        dayName: row.day_name,
        dateTitle: row.date_title,
        seatLabel: formatSeatNumber(row.seat_number),
        checkedInAt: nowIso,
        attendeeName: row.attendee_name,
        isStaffAuthenticated: true
      };
    });
    tx.immediate();
    return result;
  }
  function getAdminOverview() {
    const dates = getFestivalDates();
    const bookingCountRow = db.prepare(`SELECT COUNT(*) AS count FROM bookings WHERE status != 'cancelled'`).get();
    const totalReservations = dates.reduce((sum, d) => sum + d.bookedCount, 0);
    const totalCheckedIn = dates.reduce((sum, d) => sum + d.checkedInCount, 0);
    return {
      totalBookings: bookingCountRow.count,
      totalReservations,
      totalCheckedIn,
      capacityPerDate: FESTIVAL_INFO.capacityPerDate,
      dates
    };
  }
  function getAdminRegistrations(filters) {
    const clauses = [];
    const params = [];
    if (filters?.dateId && filters.dateId !== "all") {
      clauses.push("t.festival_date_id = ?");
      params.push(filters.dateId);
    }
    if (filters?.checkInStatus && filters.checkInStatus !== "all") {
      clauses.push("t.status = ?");
      params.push(filters.checkInStatus);
    }
    if (filters?.registrationDate) {
      clauses.push("substr(t.created_at, 1, 10) = ?");
      params.push(filters.registrationDate);
    }
    if (filters?.search && filters.search.trim().length > 0) {
      const term = `%${filters.search.trim()}%`;
      clauses.push(
        `(b.attendee_name LIKE ? OR b.phone LIKE ? OR t.id LIKE ? OR printf('%03d', t.seat_number) LIKE ?)`
      );
      params.push(term, term, term, term);
    }
    const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    const rows = db.prepare(
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
    ).all(...params);
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
      createdAt: r.created_at
    }));
  }
  function getAdminSeatMap(dateId) {
    const dates = getFestivalDates();
    const date = dates.find((d) => d.id === dateId);
    if (!date) return null;
    const regs = getAdminRegistrations({ dateId }).filter(
      (r) => r.ticketStatus !== "cancelled"
    );
    const bySeat = /* @__PURE__ */ new Map();
    for (const r of regs) {
      bySeat.set(r.seatNumber, r);
    }
    const seats = [];
    for (let s = 1; s <= date.capacity; s++) {
      const reg = bySeat.get(s) ?? null;
      let status = "available";
      if (reg) {
        status = reg.ticketStatus === "checked_in" ? "checked_in" : "booked";
      }
      seats.push({
        seatNumber: s,
        seatLabel: formatSeatNumber(s),
        status,
        registration: reg
      });
    }
    return { date, seats };
  }
  function cancelTicket(ticketId, reason) {
    let response = { ok: false, error: "Ticket not found." };
    const tx = db.transaction(() => {
      const ticket = db.prepare(
        `SELECT id, booking_id, festival_date_id, seat_number, status
           FROM tickets WHERE id = ?`
      ).get(ticketId);
      if (!ticket) {
        response = { ok: false, error: "Ticket not found." };
        return;
      }
      if (ticket.status === "cancelled") {
        response = { ok: false, error: "Ticket is already cancelled." };
        return;
      }
      db.prepare(`UPDATE tickets SET status = 'cancelled' WHERE id = ?`).run(ticket.id);
      const remainingActive = db.prepare(
        `SELECT COUNT(*) AS count FROM tickets WHERE booking_id = ? AND status != 'cancelled'`
      ).get(ticket.booking_id);
      const newBookingStatus = remainingActive.count === 0 ? "cancelled" : "partially_cancelled";
      db.prepare(`UPDATE bookings SET status = ? WHERE id = ?`).run(
        newBookingStatus,
        ticket.booking_id
      );
      recordAuditLog("TICKET_CANCEL", ticket.id, {
        bookingId: ticket.booking_id,
        festivalDateId: ticket.festival_date_id,
        seatNumber: ticket.seat_number,
        reason: reason ?? "Cancelled by administrator"
      });
      response = { ok: true };
    });
    tx.immediate();
    return response;
  }
  function updateDateBookingStatus(dateId, status) {
    const res = db.prepare(`UPDATE festival_dates SET booking_status = ? WHERE id = ?`).run(status, dateId);
    if (res.changes > 0) {
      recordAuditLog("DATE_STATUS_CHANGE", dateId, { bookingStatus: status });
      return true;
    }
    return false;
  }
  function recordAuditLog(action, targetId, metadata = {}) {
    db.prepare(
      `INSERT INTO admin_audit_logs (action, target_id, timestamp, metadata_json)
       VALUES (?, ?, ?, ?)`
    ).run(action, targetId, (/* @__PURE__ */ new Date()).toISOString(), JSON.stringify(metadata));
  }
  function getAuditLogs(limit = 50) {
    const rows = db.prepare(
      `SELECT id, action, target_id, timestamp, metadata_json
         FROM admin_audit_logs
         ORDER BY id DESC
         LIMIT ?`
    ).all(limit);
    return rows.map((r) => ({
      id: r.id,
      action: r.action,
      targetId: r.target_id,
      timestamp: r.timestamp,
      metadata: JSON.parse(r.metadata_json)
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
    recordAuditLog
  };
}

// server.ts
var PORT = Number(process.env.PORT || 3e3);
var isProduction = process.env.NODE_ENV === "production";
async function startServer() {
  const dbService = createDatabaseService();
  const app = createApiApp(dbService);
  if (!isProduction) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== "true"
      },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path2.resolve(process.cwd(), "dist");
    app.use(express2.static(distDir));
    app.get("*", (_req, res) => {
      res.sendFile(path2.join(distDir, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`MARGAZHI server listening on http://localhost:${PORT}`);
  });
}
startServer().catch((err) => {
  console.error("Failed to start MARGAZHI server:", err);
  process.exit(1);
});
