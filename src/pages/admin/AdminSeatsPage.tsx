import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FESTIVAL_DATES_SEED } from '../../shared/festivalSchedule';
import { formatIndianPhoneDisplay } from '../../shared/seatAllocation';
import type { AdminSeatCell, FestivalDateDTO } from '../../shared/types';
import {
  adminCancelTicket,
  adminCheckInTicket,
  fetchAdminSeatMap,
} from '../../utils/api';
import { AdminLayout } from './AdminLayout';

export function AdminSeatsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialDate = searchParams.get('date') || FESTIVAL_DATES_SEED[0].id;
  const [dateId, setDateId] = useState(initialDate);
  const [dateInfo, setDateInfo] = useState<FestivalDateDTO | null>(null);
  const [seats, setSeats] = useState<AdminSeatCell[]>([]);
  const [selectedSeat, setSelectedSeat] = useState<AdminSeatCell | null>(null);
  const [loading, setLoading] = useState(true);

  const loadMap = async (targetDateId: string) => {
    setLoading(true);
    try {
      const data = await fetchAdminSeatMap(targetDateId);
      setDateInfo(data.date);
      setSeats(data.seats);
      if (selectedSeat) {
        const refreshed = data.seats.find((s) => s.seatNumber === selectedSeat.seatNumber) ?? null;
        setSelectedSeat(refreshed);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMap(dateId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateId]);

  const handleSelectDate = (newId: string) => {
    setDateId(newId);
    setSelectedSeat(null);
    setSearchParams({ date: newId });
  };

  const handleCheckIn = async (ticketId: string) => {
    await adminCheckInTicket(ticketId);
    await loadMap(dateId);
  };

  const handleCancel = async (ticketId: string) => {
    await adminCancelTicket(ticketId, 'Cancelled from Seat Map');
    setSelectedSeat(null);
    await loadMap(dateId);
  };

  return (
    <AdminLayout
      title="Visual 150-Seat Map"
      subtitle="Select any festival date and click a booked seat to inspect registration details"
    >
      {/* Date Picker Strip */}
      <div className="bg-white border border-[#EAE5DC] p-4 mb-6 flex gap-2 overflow-x-auto">
        {FESTIVAL_DATES_SEED.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => handleSelectDate(d.id)}
            className={`shrink-0 px-3.5 py-2 text-xs font-medium border transition-colors ${
              dateId === d.id
                ? 'border-[#B49A6C] bg-[#EAE5DC]/60 text-[#242424]'
                : 'border-[#EAE5DC] bg-[#FAF8F4] text-[#525252] hover:border-[#B49A6C]'
            }`}
          >
            Day {d.dayNumber} · {d.dateNumber} {d.monthAbbr}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start">
        {/* 150-Seat Grid */}
        <div className="bg-white border border-[#EAE5DC] p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#EAE5DC]">
            <div>
              <h2 className="font-serif text-xl font-semibold text-[#242424]">
                {dateInfo ? `${dateInfo.dayName}, ${dateInfo.dateNumber} ${dateInfo.monthFull}` : 'Auditorium Grid'}
              </h2>
              {dateInfo && (
                <p className="text-xs text-[#737373] tabular-nums">
                  {dateInfo.bookedCount} booked · {dateInfo.remainingSeats} available ·{' '}
                  {dateInfo.checkedInCount} checked in
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 border border-[#EAE5DC] bg-[#FAF8F4] inline-block" />
                Available
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 border border-[#B49A6C] bg-[#B49A6C] inline-block" />
                Booked
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 border border-[#242424] bg-[#242424] inline-block" />
                Checked In
              </span>
            </div>
          </div>

          {loading ? (
            <div className="h-80 bg-[#EAE5DC]/40 animate-pulse mt-4" />
          ) : (
            <div className="mt-5 grid grid-cols-5 sm:grid-cols-10 gap-2">
              {seats.map((seat) => {
                const isSelected = selectedSeat?.seatNumber === seat.seatNumber;
                const styleClass =
                  seat.status === 'checked_in'
                    ? 'bg-[#242424] border-[#242424] text-[#FAF8F4]'
                    : seat.status === 'booked'
                      ? 'bg-[#B49A6C] border-[#B49A6C] text-white'
                      : 'bg-[#FAF8F4] border-[#EAE5DC] text-[#737373] hover:border-[#B49A6C]';

                return (
                  <button
                    key={seat.seatNumber}
                    type="button"
                    onClick={() => setSelectedSeat(seat)}
                    aria-label={`Seat ${seat.seatLabel} — ${seat.status.replace('_', ' ')}`}
                    className={`py-2 text-xs font-mono tabular-nums border transition-transform ${styleClass} ${
                      isSelected ? 'ring-2 ring-[#242424] ring-offset-1' : ''
                    }`}
                  >
                    {seat.seatLabel}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Seat Details Panel */}
        <aside className="bg-white border border-[#EAE5DC] p-6">
          <h3 className="font-serif text-xl font-semibold text-[#242424] border-b border-[#EAE5DC] pb-3">
            Seat Inspector
          </h3>

          {!selectedSeat ? (
            <p className="mt-4 text-sm text-[#737373]">
              Click any seat in the 150-seat grid to inspect its status and registration record.
            </p>
          ) : selectedSeat.status === 'available' || !selectedSeat.registration ? (
            <div className="mt-4 space-y-2">
              <p className="font-serif text-3xl font-semibold text-[#242424] tabular-nums">
                Seat {selectedSeat.seatLabel}
              </p>
              <p className="text-sm text-[#737373]">Status: Available for booking</p>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-[#977E52]">
                  {selectedSeat.status === 'checked_in' ? 'Checked In' : 'Booked'}
                </p>
                <p className="font-serif text-3xl font-semibold text-[#242424] tabular-nums">
                  Seat {selectedSeat.seatLabel}
                </p>
              </div>

              <dl className="divide-y divide-[#EAE5DC] text-xs">
                <div className="py-2 flex justify-between gap-2">
                  <dt className="text-[#737373]">Attendee</dt>
                  <dd className="font-medium text-right">{selectedSeat.registration.fullName}</dd>
                </div>
                <div className="py-2 flex justify-between gap-2">
                  <dt className="text-[#737373]">Phone</dt>
                  <dd className="font-mono text-right">
                    {formatIndianPhoneDisplay(selectedSeat.registration.phone)}
                  </dd>
                </div>
                <div className="py-2 flex justify-between gap-2">
                  <dt className="text-[#737373]">Gender</dt>
                  <dd className="text-right">{selectedSeat.registration.gender}</dd>
                </div>
                <div className="py-2 flex justify-between gap-2">
                  <dt className="text-[#737373]">Address</dt>
                  <dd className="text-right">{selectedSeat.registration.address}</dd>
                </div>
                <div className="py-2 flex justify-between gap-2">
                  <dt className="text-[#737373]">Ticket ID</dt>
                  <dd className="font-mono text-right">{selectedSeat.registration.ticketId}</dd>
                </div>
              </dl>

              {selectedSeat.status === 'booked' && (
                <div className="pt-2 space-y-2">
                  <button
                    type="button"
                    onClick={() => handleCheckIn(selectedSeat.registration!.ticketId)}
                    className="w-full py-2.5 text-xs font-medium uppercase tracking-[0.12em] bg-[#242424] text-white hover:bg-[#383838]"
                  >
                    Check In Attendee
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCancel(selectedSeat.registration!.ticketId)}
                    className="w-full py-2 text-xs font-medium border border-red-200 text-red-700 hover:bg-red-50"
                  >
                    Cancel Seat Reservation
                  </button>
                </div>
              )}
            </div>
          )}
        </aside>
      </div>
    </AdminLayout>
  );
}
