import { Download, Eye, Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { FESTIVAL_DATES_SEED } from '../../shared/festivalSchedule';
import { formatIndianPhoneDisplay } from '../../shared/seatAllocation';
import type { AdminRegistrationRow } from '../../shared/types';
import {
  adminCancelTicket,
  adminCheckInTicket,
  fetchAdminRegistrations,
} from '../../utils/api';
import { AdminLayout } from './AdminLayout';

export function AdminRegistrationsPage() {
  const [dateId, setDateId] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [checkInStatus, setCheckInStatus] = useState<string>('all');
  const [registrationDate, setRegistrationDate] = useState<string>('');

  const [rows, setRows] = useState<AdminRegistrationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailRow, setDetailRow] = useState<AdminRegistrationRow | null>(null);
  const [cancelTarget, setCancelTarget] = useState<AdminRegistrationRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadRows = async () => {
    setLoading(true);
    try {
      const data = await fetchAdminRegistrations({
        dateId,
        search,
        checkInStatus,
        registrationDate,
      });
      setRows(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadRows();
    }, 150);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateId, search, checkInStatus, registrationDate]);

  const handleCheckIn = async (ticketId: string) => {
    setBusyId(ticketId);
    try {
      await adminCheckInTicket(ticketId);
      await loadRows();
    } finally {
      setBusyId(null);
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancelTarget) return;
    setBusyId(cancelTarget.ticketId);
    try {
      await adminCancelTicket(cancelTarget.ticketId, 'Cancelled by administrator');
      setCancelTarget(null);
      if (detailRow?.ticketId === cancelTarget.ticketId) setDetailRow(null);
      await loadRows();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AdminLayout
      title="Registrations"
      subtitle="Search attendees, inspect protected addresses, check in, or cancel reservations"
      actions={
        <a
          href={`/api/admin/export?dateId=${encodeURIComponent(dateId)}`}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-medium tracking-[0.12em] uppercase bg-[#242424] text-[#FAF8F4] hover:bg-[#383838] transition-colors whitespace-nowrap"
        >
          <Download className="w-3.5 h-3.5" />
          Download Excel
        </a>
      }
    >
      {/* Filters Bar */}
      <div className="bg-white border border-[#EAE5DC] p-4 mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-[#737373] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, phone, seat, ticket ID..."
            aria-label="Search registrations"
            className="w-full pl-9 pr-3 py-2 bg-[#FAF8F4] border border-[#EAE5DC] text-sm focus:outline-none focus:border-[#B49A6C]"
          />
        </div>

        <select
          value={dateId}
          onChange={(e) => setDateId(e.target.value)}
          aria-label="Filter by festival date"
          className="px-3 py-2 bg-[#FAF8F4] border border-[#EAE5DC] text-sm focus:outline-none focus:border-[#B49A6C]"
        >
          <option value="all">All 9 Festival Dates</option>
          {FESTIVAL_DATES_SEED.map((d) => (
            <option key={d.id} value={d.id}>
              Day {d.dayNumber} · {d.dateNumber} {d.monthAbbr} ({d.dayAbbr})
            </option>
          ))}
        </select>

        <select
          value={checkInStatus}
          onChange={(e) => setCheckInStatus(e.target.value)}
          aria-label="Filter by check-in status"
          className="px-3 py-2 bg-[#FAF8F4] border border-[#EAE5DC] text-sm focus:outline-none focus:border-[#B49A6C]"
        >
          <option value="all">All Statuses</option>
          <option value="confirmed">Confirmed (Not Checked In)</option>
          <option value="checked_in">Checked In</option>
          <option value="cancelled">Cancelled</option>
        </select>

        <input
          type="date"
          value={registrationDate}
          onChange={(e) => setRegistrationDate(e.target.value)}
          aria-label="Filter by registration date"
          className="px-3 py-2 bg-[#FAF8F4] border border-[#EAE5DC] text-sm focus:outline-none focus:border-[#B49A6C]"
        />
      </div>

      {/* Attendee Table */}
      <div className="bg-white border border-[#EAE5DC] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-[#EAE5DC] bg-[#FAF8F4] text-[11px] font-medium tracking-[0.12em] uppercase text-[#737373]">
                <th className="py-3 px-4">Seat</th>
                <th className="py-3 px-4">Full Name</th>
                <th className="py-3 px-4">Phone</th>
                <th className="py-3 px-4">Gender</th>
                <th className="py-3 px-4">Event Date</th>
                <th className="py-3 px-4">Ticket ID</th>
                <th className="py-3 px-4">Registered</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EAE5DC]">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-[#737373]">
                    Loading registrations...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-[#737373]">
                    No matching registrations found.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.ticketId} className="hover:bg-[#FAF8F4]">
                    <td className="py-3 px-4 font-mono font-semibold text-[#977E52] tabular-nums">
                      {r.seatLabel}
                    </td>
                    <td className="py-3 px-4 font-medium text-[#242424]">{r.fullName}</td>
                    <td className="py-3 px-4 font-mono text-xs tabular-nums">
                      {formatIndianPhoneDisplay(r.phone)}
                    </td>
                    <td className="py-3 px-4 text-xs text-[#525252]">{r.gender}</td>
                    <td className="py-3 px-4 text-xs whitespace-nowrap">{r.eventDate}</td>
                    <td className="py-3 px-4 font-mono text-xs tabular-nums whitespace-nowrap">
                      {r.ticketId}
                    </td>
                    <td className="py-3 px-4 text-xs text-[#737373] whitespace-nowrap">
                      {new Date(r.createdAt).toLocaleString('en-IN', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </td>
                    <td className="py-3 px-4 text-xs whitespace-nowrap">
                      {r.ticketStatus === 'checked_in'
                        ? 'Checked In'
                        : r.ticketStatus === 'cancelled'
                          ? 'Cancelled'
                          : 'Confirmed'}
                    </td>
                    <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setDetailRow(r)}
                        aria-label={`View address and details for ${r.fullName}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs border border-[#EAE5DC] bg-white hover:border-[#B49A6C]"
                      >
                        <Eye className="w-3 h-3" />
                        Details
                      </button>

                      {r.ticketStatus === 'confirmed' && (
                        <>
                          <button
                            type="button"
                            disabled={busyId === r.ticketId}
                            onClick={() => handleCheckIn(r.ticketId)}
                            className="px-2.5 py-1 text-xs bg-[#242424] text-white hover:bg-[#383838] disabled:opacity-50"
                          >
                            Check In
                          </button>
                          <button
                            type="button"
                            disabled={busyId === r.ticketId}
                            onClick={() => setCancelTarget(r)}
                            className="px-2.5 py-1 text-xs border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50"
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
      </div>

      {/* Protected Attendee Detail Panel */}
      {detailRow && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Attendee Details"
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
        >
          <div className="bg-white border border-[#EAE5DC] max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#EAE5DC] pb-3">
              <h2 className="font-serif text-2xl font-semibold text-[#242424]">
                Attendee Details
              </h2>
              <button
                type="button"
                onClick={() => setDetailRow(null)}
                aria-label="Close details"
                className="p-1 text-[#737373] hover:text-[#242424]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <dl className="divide-y divide-[#EAE5DC] text-sm">
              <div className="py-2.5 flex justify-between gap-4">
                <dt className="text-[#737373]">Full Name</dt>
                <dd className="font-medium text-right">{detailRow.fullName}</dd>
              </div>
              <div className="py-2.5 flex justify-between gap-4">
                <dt className="text-[#737373]">Phone</dt>
                <dd className="font-mono text-right">{formatIndianPhoneDisplay(detailRow.phone)}</dd>
              </div>
              <div className="py-2.5 flex justify-between gap-4">
                <dt className="text-[#737373]">Gender</dt>
                <dd className="text-right">{detailRow.gender}</dd>
              </div>
              <div className="py-2.5 flex justify-between gap-4">
                <dt className="text-[#737373] shrink-0">Protected Address</dt>
                <dd className="text-right text-[#242424]">{detailRow.address}</dd>
              </div>
              <div className="py-2.5 flex justify-between gap-4">
                <dt className="text-[#737373]">Ticket & Seat</dt>
                <dd className="font-mono text-right">
                  {detailRow.ticketId} · Seat {detailRow.seatLabel}
                </dd>
              </div>
              <div className="py-2.5 flex justify-between gap-4">
                <dt className="text-[#737373]">Booking ID</dt>
                <dd className="font-mono text-right">{detailRow.bookingId}</dd>
              </div>
            </dl>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setDetailRow(null)}
                className="px-4 py-2 text-xs font-medium uppercase tracking-[0.12em] bg-[#242424] text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {cancelTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm Cancellation"
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
        >
          <div className="bg-white border border-[#EAE5DC] max-w-md w-full p-6 space-y-4">
            <h2 className="font-serif text-2xl font-semibold text-[#242424]">
              Cancel Ticket Reservation?
            </h2>
            <p className="text-sm text-[#525252]">
              Are you sure you want to cancel ticket{' '}
              <strong className="font-mono">{cancelTarget.ticketId}</strong> (Seat{' '}
              {cancelTarget.seatLabel}) for <strong>{cancelTarget.fullName}</strong> on{' '}
              {cancelTarget.eventDate}? Seat {cancelTarget.seatLabel} will immediately return to
              available inventory.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                className="px-4 py-2 text-xs font-medium border border-[#EAE5DC] bg-white text-[#242424]"
              >
                Keep Reservation
              </button>
              <button
                type="button"
                disabled={busyId === cancelTarget.ticketId}
                onClick={handleConfirmCancel}
                className="px-4 py-2 text-xs font-medium bg-red-700 text-white hover:bg-red-800 disabled:opacity-50"
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
