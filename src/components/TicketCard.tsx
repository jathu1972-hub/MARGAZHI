import { Download, ExternalLink, Image as ImageIcon, Printer } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { PublicTicketDTO } from '../shared/types';
import {
  buildTicketVerifyUrl,
  buildTicketViewUrl,
  downloadTicketAsPng,
  downloadTicketsAsPdf,
  generateQrDataUrl,
} from '../utils/ticketExport';

interface TicketCardProps {
  ticket: PublicTicketDTO;
  showOpenLink?: boolean;
}

function formatReadableDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  return dt.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function TicketCard({ ticket, showOpenLink = true }: TicketCardProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [busyAction, setBusyAction] = useState<'png' | 'pdf' | null>(null);

  useEffect(() => {
    let active = true;
    generateQrDataUrl(buildTicketVerifyUrl(ticket))
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [ticket]);

  const handlePng = async () => {
    setBusyAction('png');
    try {
      await downloadTicketAsPng(ticket);
    } finally {
      setBusyAction(null);
    }
  };

  const handlePdf = async () => {
    setBusyAction('pdf');
    try {
      await downloadTicketsAsPdf([ticket], ticket.id);
    } finally {
      setBusyAction(null);
    }
  };

  const statusText =
    ticket.status === 'checked_in'
      ? 'Checked In'
      : ticket.status === 'cancelled'
        ? 'Cancelled'
        : 'Confirmed';

  return (
    <article
      data-testid={`ticket-card-${ticket.id}`}
      className="bg-white border border-[#B49A6C]/60 shadow-sm print-break-inside-avoid"
    >
      <div className="p-1.5 border border-[#EAE5DC] m-1.5">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px]">
          {/* Left Invitation Details */}
          <div className="p-6 sm:p-8 flex flex-col justify-between gap-6 border-b lg:border-b-0 lg:border-r border-dashed border-[#D5CCB9]">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-medium tracking-[0.16em] uppercase text-[#977E52]">
                <span>Sri Rama Bhaktha Jana Samaj · Day {ticket.dayNumber}</span>
                <span>Status: {statusText}</span>
              </div>

              <h3 className="mt-2 font-serif text-3xl sm:text-4xl font-semibold tracking-[0.08em] text-[#242424]">
                MARGAZHI
              </h3>
              <p className="font-serif text-base text-[#737373]">
                28th Annual December Music Festival 2026
              </p>

              <div className="mt-5 pt-5 border-t border-[#EAE5DC] grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-[11px] font-medium tracking-[0.14em] uppercase text-[#737373]">
                    Attendee
                  </p>
                  <p className="mt-1 font-serif text-xl font-semibold text-[#242424]">
                    {ticket.attendeeName}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-medium tracking-[0.14em] uppercase text-[#737373]">
                    Event Date
                  </p>
                  <p className="mt-1 font-serif text-xl font-semibold text-[#242424]">
                    {ticket.dayName}, {formatReadableDate(ticket.eventDate)}
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                <p className="text-[11px] font-medium tracking-[0.14em] uppercase text-[#737373]">
                  Concert Details
                </p>
                {ticket.sessions.map((session) => (
                  <div key={session.id} className="space-y-0.5">
                    <p className="text-xs font-medium text-[#977E52]">
                      {session.startTime} – {session.endTime}
                    </p>
                    <p className="font-serif text-lg font-medium text-[#242424] leading-snug">
                      {session.title}
                    </p>
                    <p className="text-xs text-[#525252] leading-relaxed">
                      {session.performers.join(' · ')}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-[#EAE5DC] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-[#737373]">
              <span>
                <strong className="font-medium text-[#242424]">{ticket.venue}</strong>,{' '}
                {ticket.venueAddress}
              </span>
              <span className="font-mono text-[#525252] tabular-nums shrink-0">{ticket.id}</span>
            </div>
          </div>

          {/* Right Stub: Seat + QR */}
          <div className="p-6 bg-[#FAF8F4] flex flex-col items-center justify-between text-center gap-4">
            <div>
              <p className="text-[11px] font-medium tracking-[0.16em] uppercase text-[#737373]">
                Allocated Seat
              </p>
              <p
                data-testid={`ticket-seat-${ticket.id}`}
                className="mt-1 font-serif text-5xl font-semibold text-[#977E52] tabular-nums"
              >
                {ticket.seatLabel}
              </p>
              <p className="mt-1 font-mono text-xs text-[#525252] tabular-nums">{ticket.id}</p>
            </div>

            <div className="bg-white p-2.5 border border-[#EAE5DC]">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt={`QR Verification Code for ${ticket.id}`}
                  className="w-36 h-36 object-contain"
                />
              ) : (
                <div className="w-36 h-36 bg-[#EAE5DC]/40 animate-pulse" />
              )}
            </div>

            <p className="text-[11px] text-[#737373] leading-relaxed">
              Present this QR code at the auditorium entrance. Admit one.
            </p>
          </div>
        </div>
      </div>

      {/* Per-ticket action bar */}
      <div className="px-6 py-3 bg-[#FAF8F4] border-t border-[#EAE5DC] flex flex-wrap items-center justify-between gap-2 no-print">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handlePdf}
            disabled={busyAction !== null}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border border-[#242424] bg-[#242424] text-[#FAF8F4] hover:bg-[#383838] transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            {busyAction === 'pdf' ? 'Preparing PDF...' : 'Download Individual Ticket'}
          </button>

          <button
            type="button"
            onClick={handlePng}
            disabled={busyAction !== null}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border border-[#B49A6C] bg-white text-[#242424] hover:bg-[#EAE5DC]/40 transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            <ImageIcon className="w-3.5 h-3.5" />
            {busyAction === 'png' ? 'Saving PNG...' : 'Save Ticket as PNG'}
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border border-[#EAE5DC] bg-white text-[#242424] hover:bg-[#EAE5DC]/40 transition-colors whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5" />
            Print Ticket
          </button>
        </div>

        {showOpenLink && ticket.verificationToken && (
          <Link
            to={buildTicketViewUrl(ticket)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#977E52] hover:text-[#242424] transition-colors whitespace-nowrap"
          >
            Open Ticket Page
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>
    </article>
  );
}
