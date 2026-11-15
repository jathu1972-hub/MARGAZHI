import { ArrowRight, Clock, MapPin } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PublicLayout } from '../components/Layout';
import { FESTIVAL_DATES_SEED, FESTIVAL_INFO } from '../shared/festivalSchedule';
import type { FestivalDateDTO } from '../shared/types';
import { fetchFestivalDates } from '../utils/api';

export function SchedulePage() {
  const [dates, setDates] = useState<FestivalDateDTO[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchFestivalDates()
      .then((data) => {
        if (active) setDates(data);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const displayDates = dates ?? FESTIVAL_DATES_SEED.map((d) => ({
    ...d,
    bookingStatus: 'open' as const,
    bookedCount: 0,
    remainingSeats: d.capacity,
    checkedInCount: 0,
    sessions: d.sessions.map((s) => ({ ...s, festivalDateId: d.id })),
  }));

  return (
    <PublicLayout>
      <section className="border-b border-[#EAE5DC] bg-[#FAF8F4] py-12 sm:py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-xs font-medium tracking-[0.18em] uppercase text-[#977E52]">
            {FESTIVAL_INFO.organizer} · {FESTIVAL_INFO.edition}
          </p>
          <h1 className="mt-3 font-serif text-4xl sm:text-5xl font-semibold text-[#242424]">
            Official Festival Schedule
          </h1>
          <p className="mt-3 text-base text-[#525252] max-w-2xl leading-relaxed">
            {FESTIVAL_INFO.duration} at {FESTIVAL_INFO.venue}, {FESTIVAL_INFO.venueAddress}. Select
            any evening below to reserve complimentary numbered seating.
          </p>
        </div>
      </section>

      <section className="py-12 sm:py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          {displayDates.map((day) => {
            const isSoldOut = day.remainingSeats === 0 || day.bookingStatus === 'closed';
            return (
              <article
                key={day.id}
                className="bg-white border border-[#EAE5DC] p-6 sm:p-8 hover:border-[#B49A6C] transition-colors"
              >
                <div className="grid grid-cols-1 md:grid-cols-[210px_1fr] gap-6 md:gap-8">
                  {/* Date Column */}
                  <div className="md:border-r md:border-[#EAE5DC] md:pr-6 flex flex-row md:flex-col justify-between md:justify-start gap-2">
                    <div>
                      <p className="text-xs font-medium tracking-[0.16em] uppercase text-[#977E52]">
                        Day {day.dayNumber}
                      </p>
                      <p className="mt-1 font-serif text-3xl sm:text-4xl font-semibold text-[#242424] tabular-nums">
                        {day.dateNumber} {day.monthAbbr}
                      </p>
                      <p className="text-sm text-[#525252]">
                        {day.dayName}, {day.year}
                      </p>
                    </div>

                    <div className="md:mt-6 text-right md:text-left">
                      <p className="text-xs text-[#737373] tabular-nums">
                        {loading ? 'Checking seats...' : `${day.remainingSeats} of ${day.capacity} seats left`}
                      </p>
                      <Link
                        to={`/book?date=${encodeURIComponent(day.id)}`}
                        className={`mt-3 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium tracking-[0.12em] uppercase transition-colors whitespace-nowrap ${
                          isSoldOut
                            ? 'border border-[#EAE5DC] text-[#737373] bg-[#FAF8F4]'
                            : 'bg-[#242424] text-[#FAF8F4] hover:bg-[#383838]'
                        }`}
                      >
                        {day.bookingStatus === 'closed'
                          ? 'Booking Closed'
                          : day.remainingSeats === 0
                            ? 'Sold Out'
                            : 'Book Date'}
                        {!isSoldOut && <ArrowRight className="w-3.5 h-3.5" />}
                      </Link>
                    </div>
                  </div>

                  {/* Sessions Column */}
                  <div className="space-y-6">
                    {day.sessions.map((session, idx) => (
                      <div
                        key={session.id}
                        className={idx > 0 ? 'pt-5 border-t border-[#EAE5DC]' : ''}
                      >
                        <div className="flex items-center gap-2 text-xs font-medium text-[#977E52]">
                          <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>
                            {session.startTime} – {session.endTime}
                          </span>
                        </div>
                        <h2 className="mt-1.5 font-serif text-2xl font-semibold text-[#242424]">
                          {session.title}
                        </h2>
                        <ul className="mt-2.5 space-y-1 text-sm text-[#525252]">
                          {session.performers.map((perf) => (
                            <li key={perf}>{perf}</li>
                          ))}
                        </ul>
                      </div>
                    ))}

                    <div className="pt-4 border-t border-[#EAE5DC] flex items-center gap-2 text-xs text-[#737373]">
                      <MapPin className="w-3.5 h-3.5 text-[#B49A6C] shrink-0" aria-hidden="true" />
                      <span>
                        {FESTIVAL_INFO.venue}, {FESTIVAL_INFO.venueAddress}
                      </span>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </PublicLayout>
  );
}
