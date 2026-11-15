import { Download } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { AdminRegistrationRow, FestivalDateDTO } from '../../shared/types';
import {
  adminCancelTicket,
  adminCheckInTicket,
  fetchAdminOverview,
  fetchAdminRegistrations,
} from '../../utils/api';
import { AdminLayout } from './AdminLayout';

export function AdminDashboardPage() {
  const [overview, setOverview] = useState<{
    totalBookings: number;
    totalReservations: number;
    totalCheckedIn: number;
    capacityPerDate: number;
    dates: FestivalDateDTO[];
  } | null>(null);
  const [selectedDateId, setSelectedDateId] = useState<string>('');
  const [dateRegistrations, setDateRegistrations] = useState<AdminRegistrationRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async (dateOverride?: string) => {
    setLoading(true);
    try {
      const ov = await fetchAdminOverview();
      setOverview(ov);
      const targetId = dateOverride || selectedDateId || ov.dates[0]?.id || '';
      setSelectedDateId(targetId);
      if (targetId) {
        const regs = await fetchAdminRegistrations({ dateId: targetId });
        setDateRegistrations(regs);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDateChange = async (dateId: string) => {
    setSelectedDateId(dateId);
    const regs = await fetchAdminRegistrations({ dateId });
    setDateRegistrations(regs);
  };

  const selectedDate = useMemo(
    () => overview?.dates.find((d) => d.id === selectedDateId) ?? null,
    [overview, selectedDateId]
  );

  const handleCheckIn = async (ticketId: string) => {
    await adminCheckInTicket(ticketId);
    await loadData(selectedDateId);
  };

  const handleCancel = async (ticketId: string) => {
    await adminCancelTicket(ticketId, 'Cancelled from admin dashboard');
    await loadData(selectedDateId);
  };

  return (
    <AdminLayout
      title="Festival Dashboard"
      subtitle="28th Annual December Music Festival 2026 · Live Operations"
      actions={
        <a
          href="/api/admin/export"
          className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-medium tracking-[0.12em] uppercase bg-[#242424] text-[#FAF8F4] hover:bg-[#383838] transition-colors whitespace-nowrap"
        >
          <Download className="w-3.5 h-3.5" />
          Download Excel
        </a>
      }
    >
      {loading && !overview ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 bg-[#EAE5DC]/50 animate-pulse border border-[#EAE5DC]" />
          ))}
        </div>
      ) : (
        overview && (
          <div className="space-y-8">
            {/* 4 Required Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-[#EAE5DC] p-5">
                <p className="text-xs font-medium tracking-[0.14em] uppercase text-[#737373]">
                  Total Bookings
                </p>
                <p className="mt-2 font-serif text-4xl font-semibold text-[#242424] tabular-nums">
                  {overview.totalBookings}
                </p>
                <p className="mt-1 text-xs text-[#737373]">Unique booking transactions</p>
              </div>

              <div className="bg-white border border-[#EAE5DC] p-5">
                <p className="text-xs font-medium tracking-[0.14em] uppercase text-[#737373]">
                  Total Ticket Reservations
                </p>
                <p className="mt-2 font-serif text-4xl font-semibold text-[#242424] tabular-nums">
                  {overview.totalReservations}
                </p>
                <p className="mt-1 text-xs text-[#737373] tabular-nums">
                  {overview.totalCheckedIn} checked in across 9 dates
                </p>
              </div>

              <div className="bg-white border border-[#EAE5DC] p-5">
                <p className="text-xs font-medium tracking-[0.14em] uppercase text-[#737373]">
                  Available Seats
                </p>
                <p className="mt-2 font-serif text-4xl font-semibold text-[#977E52] tabular-nums">
                  {selectedDate?.remainingSeats ?? 150}
                </p>
                <p className="mt-1 text-xs text-[#737373]">
                  {selectedDate ? `${selectedDate.dayAbbr} ${selectedDate.dateNumber} ${selectedDate.monthAbbr}` : 'Selected date'}
                </p>
              </div>

              <div className="bg-white border border-[#EAE5DC] p-5">
                <p className="text-xs font-medium tracking-[0.14em] uppercase text-[#737373]">
                  Total Capacity
                </p>
                <p className="mt-2 font-serif text-4xl font-semibold text-[#242424] tabular-nums">
                  {overview.capacityPerDate}
                </p>
                <p className="mt-1 text-xs text-[#737373]">Seats per festival date</p>
              </div>
            </div>

            {/* 9-Date Selector */}
            <div className="bg-white border border-[#EAE5DC] p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#EAE5DC]">
                <h2 className="font-serif text-2xl font-semibold text-[#242424]">
                  Date-Wise Attendance & Availability
                </h2>
                <Link
                  to={`/admin/seats?date=${encodeURIComponent(selectedDateId)}`}
                  className="text-xs font-medium tracking-[0.12em] uppercase text-[#977E52] hover:text-[#242424] underline"
                >
                  Open 150-Seat Visual Map
                </Link>
              </div>

              <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
                {overview.dates.map((d) => {
                  const active = d.id === selectedDateId;
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => handleDateChange(d.id)}
                      className={`shrink-0 px-3.5 py-2 text-left border transition-colors ${
                        active
                          ? 'border-[#B49A6C] bg-[#EAE5DC]/60 text-[#242424]'
                          : 'border-[#EAE5DC] bg-[#FAF8F4] text-[#525252] hover:border-[#B49A6C]'
                      }`}
                    >
                      <span className="block text-[10px] font-medium uppercase tracking-[0.12em] text-[#737373]">
                        Day {d.dayNumber} · {d.dayAbbr}
                      </span>
                      <span className="block font-serif text-lg font-semibold tabular-nums">
                        {d.dateNumber} {d.monthAbbr}
                      </span>
                      <span className="block text-[11px] text-[#977E52] tabular-nums">
                        {d.bookedCount}/{d.capacity} booked
                      </span>
                    </button>
                  );
                })}
              </div>

              {selectedDate && (
                <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-4 py-4 px-4 bg-[#FAF8F4] border border-[#EAE5DC] text-sm">
                  <div>
                    <span className="text-xs text-[#737373] block">Registered Seats</span>
                    <strong className="font-medium tabular-nums">{selectedDate.bookedCount}</strong>
                  </div>
                  <div>
                    <span className="text-xs text-[#737373] block">Remaining Seats</span>
                    <strong className="font-medium tabular-nums">{selectedDate.remainingSeats}</strong>
                  </div>
                  <div>
                    <span className="text-xs text-[#737373] block">Occupancy</span>
                    <strong className="font-medium tabular-nums">
                      {((selectedDate.bookedCount / selectedDate.capacity) * 100).toFixed(1)}%
                    </strong>
                  </div>
                  <div>
                    <span className="text-xs text-[#737373] block">Checked In</span>
                    <strong className="font-medium tabular-nums">{selectedDate.checkedInCount}</strong>
                  </div>
                </div>
              )}

              {/* Selected Date Attendee Preview Table */}
              <div className="mt-6 overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-[#EAE5DC] text-[11px] font-medium tracking-[0.12em] uppercase text-[#737373]">
                      <th className="py-2.5 pr-4">Seat</th>
                      <th className="py-2.5 pr-4">Attendee</th>
                      <th className="py-2.5 pr-4">Phone</th>
                      <th className="py-2.5 pr-4">Ticket ID</th>
                      <th className="py-2.5 pr-4">Status</th>
                      <th className="py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EAE5DC]">
                    {dateRegistrations.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-[#737373]">
                          No reservations recorded for this date yet.
                        </td>
                      </tr>
                    ) : (
                      dateRegistrations.slice(0, 15).map((reg) => (
                        <tr key={reg.ticketId} className="hover:bg-[#FAF8F4]">
                          <td className="py-3 pr-4 font-mono font-medium tabular-nums">
                            {reg.seatLabel}
                          </td>
                          <td className="py-3 pr-4 font-medium">{reg.fullName}</td>
                          <td className="py-3 pr-4 font-mono text-xs tabular-nums">{reg.phone}</td>
                          <td className="py-3 pr-4 font-mono text-xs tabular-nums">
                            {reg.ticketId}
                          </td>
                          <td className="py-3 pr-4 text-xs">
                            {reg.ticketStatus === 'checked_in'
                              ? 'Checked In'
                              : reg.ticketStatus === 'cancelled'
                                ? 'Cancelled'
                                : 'Confirmed'}
                          </td>
                          <td className="py-3 text-right space-x-2 whitespace-nowrap">
                            {reg.ticketStatus === 'confirmed' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleCheckIn(reg.ticketId)}
                                  className="px-2.5 py-1 text-xs border border-[#242424] bg-[#242424] text-white hover:bg-[#383838]"
                                >
                                  Check In
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleCancel(reg.ticketId)}
                                  className="px-2.5 py-1 text-xs border border-[#EAE5DC] text-[#737373] hover:text-red-700"
                                >
                                  Cancel
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {dateRegistrations.length > 15 && (
                <div className="mt-4 text-right">
                  <Link
                    to="/admin/registrations"
                    className="text-xs font-medium text-[#977E52] underline"
                  >
                    View all {dateRegistrations.length} registrations →
                  </Link>
                </div>
              )}
            </div>
          </div>
        )
      )}
    </AdminLayout>
  );
}
