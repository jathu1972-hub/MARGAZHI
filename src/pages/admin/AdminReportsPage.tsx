import { Download, FileSpreadsheet } from 'lucide-react';
import { FESTIVAL_DATES_SEED } from '../../shared/festivalSchedule';
import { AdminLayout } from './AdminLayout';

export function AdminReportsPage() {
  return (
    <AdminLayout
      title="Excel Reports"
      subtitle="Live PostgreSQL/SQLite exports formatted as multi-sheet .xlsx workbooks"
    >
      <div className="space-y-6">
        {/* Primary Full-Festival Export */}
        <div className="bg-white border border-[#B49A6C]/60 p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium tracking-[0.16em] uppercase text-[#977E52]">
              <FileSpreadsheet className="w-4 h-4" />
              <span>Complete Festival Workbook (.xlsx)</span>
            </div>
            <h2 className="mt-2 font-serif text-3xl font-semibold text-[#242424]">
              MARGAZHI 2026 Master Report
            </h2>
            <p className="mt-2 text-sm text-[#525252] max-w-2xl">
              Generates a formatted 4-sheet Excel workbook directly from live database records with
              frozen headers, auto-filters, and formula-injection protection.
            </p>
          </div>

          <a
            href="/api/admin/export"
            className="inline-flex items-center justify-center gap-2 px-7 py-3.5 text-xs font-medium tracking-[0.16em] uppercase bg-[#242424] text-[#FAF8F4] hover:bg-[#383838] transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-4 h-4" />
            Download Excel
          </a>
        </div>

        {/* Workbook Sheet Breakdown */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-[#EAE5DC] p-5">
            <p className="text-xs font-medium tracking-[0.14em] uppercase text-[#977E52]">
              Sheet 1
            </p>
            <h3 className="mt-1 font-serif text-xl font-semibold">Dashboard</h3>
            <p className="mt-1.5 text-xs text-[#737373] leading-relaxed">
              Event date, day, concert, total seats, registered seats, remaining seats, check-ins,
              and occupancy percentage.
            </p>
          </div>

          <div className="bg-white border border-[#EAE5DC] p-5">
            <p className="text-xs font-medium tracking-[0.14em] uppercase text-[#977E52]">
              Sheet 2
            </p>
            <h3 className="mt-1 font-serif text-xl font-semibold">Registrations</h3>
            <p className="mt-1.5 text-xs text-[#737373] leading-relaxed">
              Booking ID, ticket ID, full name, phone, address, gender, event date, seat number,
              registration timestamp, and check-in status.
            </p>
          </div>

          <div className="bg-white border border-[#EAE5DC] p-5">
            <p className="text-xs font-medium tracking-[0.14em] uppercase text-[#977E52]">
              Sheet 3
            </p>
            <h3 className="mt-1 font-serif text-xl font-semibold">Seat Map</h3>
            <p className="mt-1.5 text-xs text-[#737373] leading-relaxed">
              Matrix of Seats 001–150 across all 9 festival dates displaying FREE, BOOKED, or CHECKED
              IN status.
            </p>
          </div>

          <div className="bg-white border border-[#EAE5DC] p-5">
            <p className="text-xs font-medium tracking-[0.14em] uppercase text-[#977E52]">
              Sheet 4
            </p>
            <h3 className="mt-1 font-serif text-xl font-semibold">Festival Schedule</h3>
            <p className="mt-1.5 text-xs text-[#737373] leading-relaxed">
              Complete official 9-day MARGAZHI 2026 program with session timings and performing
              artists.
            </p>
          </div>
        </div>

        {/* Date-Wise Exports */}
        <div className="bg-white border border-[#EAE5DC] p-6">
          <h3 className="font-serif text-2xl font-semibold text-[#242424] pb-4 border-b border-[#EAE5DC]">
            Date-Wise Excel Exports
          </h3>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {FESTIVAL_DATES_SEED.map((d) => (
              <div
                key={d.id}
                className="border border-[#EAE5DC] bg-[#FAF8F4] p-4 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-xs font-medium text-[#977E52]">
                    Day {d.dayNumber} · {d.dayName}
                  </p>
                  <p className="font-serif text-lg font-semibold text-[#242424]">
                    {d.dateNumber} {d.monthFull} {d.year}
                  </p>
                </div>
                <a
                  href={`/api/admin/export?dateId=${encodeURIComponent(d.id)}`}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-[#242424] bg-white hover:bg-[#242424] hover:text-white transition-colors whitespace-nowrap shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  .xlsx
                </a>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
