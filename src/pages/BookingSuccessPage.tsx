import { CheckCircle2, Download, Printer } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { PublicLayout } from '../components/Layout';
import { TicketCard } from '../components/TicketCard';
import type { BookingConfirmationDTO } from '../shared/types';
import { fetchBookingConfirmation } from '../utils/api';
import { downloadTicketsAsPdf } from '../utils/ticketExport';

export function BookingSuccessPage() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const stateBooking = (location.state as { booking?: BookingConfirmationDTO } | null)?.booking;

  const [booking, setBooking] = useState<BookingConfirmationDTO | null>(stateBooking ?? null);
  const [loading, setLoading] = useState(!stateBooking);
  const [error, setError] = useState<string | null>(null);
  const [downloadingAll, setDownloadingAll] = useState(false);

  const bookingId = searchParams.get('id') ?? '';
  const accessToken = searchParams.get('access') ?? '';

  useEffect(() => {
    if (stateBooking) return;
    if (!bookingId || !accessToken) {
      setError('Missing booking confirmation credentials.');
      setLoading(false);
      return;
    }

    let active = true;
    fetchBookingConfirmation(bookingId, accessToken)
      .then((data) => {
        if (active) setBooking(data);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Unable to load tickets.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [bookingId, accessToken, stateBooking]);

  const handleDownloadAllPdf = async () => {
    if (!booking) return;
    setDownloadingAll(true);
    try {
      await downloadTicketsAsPdf(booking.tickets, `MARGAZHI-${booking.bookingId}`);
    } finally {
      setDownloadingAll(false);
    }
  };

  return (
    <PublicLayout>
      <section className="py-10 sm:py-14">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          {loading ? (
            <div className="space-y-4">
              <div className="h-24 bg-[#EAE5DC]/50 animate-pulse" />
              <div className="h-80 bg-[#EAE5DC]/40 animate-pulse" />
            </div>
          ) : error || !booking ? (
            <div className="bg-white border border-[#EAE5DC] p-8 text-center">
              <h1 className="font-serif text-3xl font-semibold text-[#242424]">
                Booking Not Available
              </h1>
              <p className="mt-2 text-sm text-[#737373]">{error || 'Unable to locate booking.'}</p>
              <Link
                to="/book"
                className="mt-6 inline-block px-6 py-3 text-xs font-medium tracking-[0.14em] uppercase bg-[#242424] text-[#FAF8F4]"
              >
                Return to Booking
              </Link>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-8"
            >
              <div className="bg-white border border-[#B49A6C]/50 p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 no-print">
                <div>
                  <div className="flex items-center gap-2 text-xs font-medium tracking-[0.14em] uppercase text-[#977E52]">
                    <CheckCircle2 className="w-4 h-4 text-[#977E52]" />
                    <span>Registration Confirmed · {booking.bookingId}</span>
                  </div>
                  <h1 className="mt-2 font-serif text-3xl sm:text-4xl font-semibold text-[#242424]">
                    Your MARGAZHI Admission Passes
                  </h1>
                  <p className="mt-1.5 text-sm text-[#525252]">
                    {booking.tickets.length}{' '}
                    {booking.tickets.length === 1 ? 'ticket issued' : 'dated tickets issued'} for{' '}
                    <strong className="font-medium text-[#242424]">{booking.attendeeName}</strong>.
                    {booking.tickets.length > 1 && booking.strategy === 'common'
                      ? ' The same seat number has been reserved across all selected evenings.'
                      : ''}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                  <button
                    type="button"
                    onClick={handleDownloadAllPdf}
                    disabled={downloadingAll}
                    className="inline-flex items-center gap-2 px-5 py-3 text-xs font-medium tracking-[0.12em] uppercase bg-[#242424] text-[#FAF8F4] hover:bg-[#383838] transition-colors disabled:opacity-60 whitespace-nowrap"
                  >
                    <Download className="w-4 h-4" />
                    {downloadingAll ? 'Generating PDF...' : 'Download All Tickets as PDF'}
                  </button>

                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-2 px-4 py-3 text-xs font-medium tracking-[0.12em] uppercase border border-[#EAE5DC] bg-[#FAF8F4] text-[#242424] hover:border-[#B49A6C] transition-colors whitespace-nowrap"
                  >
                    <Printer className="w-4 h-4" />
                    Print All
                  </button>
                </div>
              </div>

              <div className="space-y-6">
                {booking.tickets.map((ticket) => (
                  <TicketCard key={ticket.id} ticket={ticket} />
                ))}
              </div>

              <div className="pt-4 flex flex-wrap items-center justify-between gap-4 text-sm no-print">
                <Link
                  to="/book"
                  className="text-xs font-medium tracking-[0.12em] uppercase text-[#977E52] hover:text-[#242424] underline underline-offset-4"
                >
                  Book Another Registration
                </Link>
                <Link
                  to="/schedule"
                  className="text-xs font-medium tracking-[0.12em] uppercase text-[#737373] hover:text-[#242424]"
                >
                  View Full Festival Schedule
                </Link>
              </div>
            </motion.div>
          )}
        </div>
      </section>
    </PublicLayout>
  );
}
