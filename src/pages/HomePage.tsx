import { ArrowRight, Calendar, MapPin, Music2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PublicLayout } from '../components/Layout';
import { FESTIVAL_DATES_SEED, FESTIVAL_INFO } from '../shared/festivalSchedule';
import type { FestivalDateDTO } from '../shared/types';
import { fetchFestivalDates } from '../utils/api';

export function HomePage() {
  const [dates, setDates] = useState<FestivalDateDTO[] | null>(null);

  useEffect(() => {
    let active = true;
    fetchFestivalDates()
      .then((data) => {
        if (active) setDates(data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const schedulePreview = dates ?? FESTIVAL_DATES_SEED.map((d) => ({
    ...d,
    bookingStatus: 'open' as const,
    bookedCount: 0,
    remainingSeats: d.capacity,
    checkedInCount: 0,
    sessions: d.sessions.map((s) => ({ ...s, festivalDateId: d.id })),
  }));

  return (
    <PublicLayout>
      {/* Hero Section */}
      <section className="border-b border-[#EAE5DC] bg-[#FAF8F4]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="lg:col-span-7 flex flex-col justify-center"
            >
              {/* Subtle classical geometric tanpura-inspired hairline rule */}
              <div className="flex items-center gap-3 text-xs font-medium tracking-[0.2em] uppercase text-[#977E52]">
                <span className="inline-block w-8 h-px bg-[#B49A6C]" aria-hidden="true" />
                <span>Sri Rama Bhaktha Jana Samaj Presents</span>
              </div>

              <h1 className="mt-5 font-serif text-5xl sm:text-6xl lg:text-[72px] font-semibold tracking-[0.06em] text-[#242424] leading-[1.02]">
                MARGAZHI
              </h1>

              <p className="mt-4 font-serif text-2xl sm:text-3xl text-[#242424] leading-snug text-balance">
                28th Annual December Music Festival 2026
              </p>

              <div className="mt-6 pt-6 border-t border-[#EAE5DC] space-y-2.5 text-sm sm:text-base text-[#525252]">
                <p className="flex items-center gap-2.5">
                  <Calendar className="w-4 h-4 text-[#B49A6C] shrink-0" />
                  <span>{FESTIVAL_INFO.duration}</span>
                </p>
                <p className="flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 text-[#B49A6C] shrink-0 mt-1" />
                  <span>
                    {FESTIVAL_INFO.venue}, Virugambakkam, Chennai
                  </span>
                </p>
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link
                  to="/book"
                  className="inline-flex items-center justify-center gap-2.5 px-7 py-3.5 text-xs font-medium tracking-[0.16em] uppercase bg-[#242424] text-[#FAF8F4] hover:bg-[#383838] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B49A6C] focus-visible:ring-offset-2"
                >
                  Book Your Seat
                  <ArrowRight className="w-4 h-4" />
                </Link>

                <Link
                  to="/schedule"
                  className="inline-flex items-center justify-center gap-2 px-7 py-3.5 text-xs font-medium tracking-[0.16em] uppercase border border-[#B49A6C] text-[#242424] bg-white hover:bg-[#EAE5DC]/40 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B49A6C] focus-visible:ring-offset-2"
                >
                  Explore Festival
                </Link>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
              className="lg:col-span-5 flex flex-col"
            >
              <figure className="relative h-full bg-[#EAE5DC]/50 border border-[#EAE5DC] p-3">
                <div className="relative aspect-[3/4] lg:h-full w-full overflow-hidden bg-[#EAE5DC]">
                  <img
                    src="/src/assets/images/hero_carnatic_veena_1794732257054.jpg"
                    alt="Classical Saraswati Veena resting on ivory silk beside a traditional brass lamp"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
                <figcaption className="mt-2.5 flex items-center justify-between text-xs text-[#737373]">
                  <span className="font-serif italic">Saraswati Veena & Traditional Kutthu Vilakku</span>
                  <span className="tabular-nums">28th Edition</span>
                </figcaption>
              </figure>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Operational Utility Strip */}
      <section className="border-b border-[#EAE5DC] bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-[#EAE5DC]">
          <div className="py-5 pr-4">
            <p className="text-[11px] font-medium tracking-[0.16em] uppercase text-[#737373]">
              Festival Duration
            </p>
            <p className="mt-1 font-serif text-xl font-medium text-[#242424] tabular-nums">
              9 Evenings
            </p>
          </div>
          <div className="py-5 px-4">
            <p className="text-[11px] font-medium tracking-[0.16em] uppercase text-[#737373]">
              Auditorium Capacity
            </p>
            <p className="mt-1 font-serif text-xl font-medium text-[#242424] tabular-nums">
              150 Seats / Date
            </p>
          </div>
          <div className="py-5 pr-4 lg:px-4">
            <p className="text-[11px] font-medium tracking-[0.16em] uppercase text-[#737373]">
              Dates
            </p>
            <p className="mt-1 font-serif text-xl font-medium text-[#242424]">
              26 Dec – 3 Jan
            </p>
          </div>
          <div className="py-5 pl-4">
            <p className="text-[11px] font-medium tracking-[0.16em] uppercase text-[#737373]">
              Admission
            </p>
            <p className="mt-1 font-serif text-xl font-medium text-[#977E52]">
              Complimentary Pass
            </p>
          </div>
        </div>
      </section>

      {/* Festival Introduction (#about) */}
      <section id="about" className="py-16 sm:py-20 border-b border-[#EAE5DC]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          <div className="lg:col-span-5 order-2 lg:order-1">
            <div className="bg-white border border-[#EAE5DC] p-3">
              <div className="aspect-[4/3] overflow-hidden bg-[#EAE5DC]">
                <img
                  src="/src/assets/images/classical_instruments_pair_1794732257761.jpg"
                  alt="Carnatic violin and wooden mridangam prepared for concert"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 order-1 lg:order-2">
            <p className="text-xs font-medium tracking-[0.18em] uppercase text-[#977E52]">
              About the Festival
            </p>
            <h2 className="mt-3 font-serif text-3xl sm:text-4xl font-semibold text-[#242424] text-balance">
              A Celebration of Classical Heritage & Devotional Resonance
            </h2>
            <div className="mt-6 space-y-4 text-[#525252] leading-relaxed max-w-2xl">
              <p className="first-letter:text-5xl first-letter:font-serif first-letter:font-semibold first-letter:text-[#242424] first-letter:float-left first-letter:mr-3 first-letter:leading-none">
                Hosted each December by Sri Rama Bhaktha Jana Samaj of K.K. Nagar, Chennai, the
                28th Annual December Music Festival brings rasikas together in the sacred spirit of
                Margazhi. Over nine consecutive evenings, the festival honours timeless Carnatic
                traditions through luminous concerts by revered maestros alongside inspiring
                presentations by emerging young musicians.
              </p>
              <p>
                Opening with the conferment of the Sangeetha Maamani Award upon Sangita Kalanidhi
                Kumari A. Kanyakumari and culminating in Namasankeerthanam, every evening is curated
                for intimate acoustic listening. Visitors may reserve seats for a single concert or
                curate their own multi-day itinerary with instant digital QR passes.
              </p>
            </div>
            <div className="mt-7 flex items-center gap-6 text-sm">
              <Link
                to="/schedule"
                className="inline-flex items-center gap-2 font-medium text-[#242424] border-b border-[#B49A6C] pb-0.5 hover:text-[#977E52] transition-colors"
              >
                View Full 9-Day Lineup
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/book"
                className="inline-flex items-center gap-2 font-medium text-[#737373] hover:text-[#242424] transition-colors"
              >
                Select Dates
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Festival Schedule Overview */}
      <section className="py-16 sm:py-20 border-b border-[#EAE5DC] bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-8 border-b border-[#EAE5DC]">
            <div>
              <p className="text-xs font-medium tracking-[0.18em] uppercase text-[#977E52]">
                Official Concert Program
              </p>
              <h2 className="mt-2 font-serif text-3xl sm:text-4xl font-semibold text-[#242424]">
                Nine Evenings of Carnatic Music
              </h2>
            </div>
            <Link
              to="/schedule"
              className="inline-flex items-center gap-2 text-xs font-medium tracking-[0.14em] uppercase text-[#242424] border-b border-[#B49A6C] pb-1 hover:text-[#977E52] transition-colors self-start sm:self-auto"
            >
              Complete Schedule Details
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {schedulePreview.map((day) => (
              <div
                key={day.id}
                className="group border border-[#EAE5DC] bg-[#FAF8F4] p-6 flex flex-col justify-between hover:border-[#B49A6C] transition-colors"
              >
                <div>
                  <div className="flex items-baseline justify-between gap-2 text-xs text-[#737373]">
                    <span className="font-medium tracking-[0.14em] uppercase text-[#977E52]">
                      Day {day.dayNumber} · {day.dayAbbr}
                    </span>
                    <span className="tabular-nums">
                      {day.remainingSeats > 0
                        ? `${day.remainingSeats} seats available`
                        : 'Sold out'}
                    </span>
                  </div>

                  <p className="mt-2 font-serif text-2xl font-semibold text-[#242424]">
                    {day.dateNumber} {day.monthFull} {day.year}
                  </p>

                  <div className="mt-4 space-y-2.5 border-t border-[#EAE5DC] pt-4">
                    {day.sessions.map((session) => (
                      <div key={session.id}>
                        <p className="text-[11px] font-medium text-[#737373]">
                          {session.startTime} – {session.endTime}
                        </p>
                        <p className="text-sm font-medium text-[#242424] leading-snug">
                          {session.title}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-[#EAE5DC] flex items-center justify-between">
                  <Link
                    to={`/book?date=${encodeURIComponent(day.id)}`}
                    className="inline-flex items-center gap-1.5 text-xs font-medium tracking-[0.12em] uppercase text-[#242424] hover:text-[#977E52] transition-colors"
                  >
                    Reserve Seat
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                  <Music2 className="w-4 h-4 text-[#B49A6C]/70" aria-hidden="true" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Venue & Contact (#contact) */}
      <section id="contact" className="py-16 sm:py-20 bg-[#FAF8F4]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-6">
            <p className="text-xs font-medium tracking-[0.18em] uppercase text-[#977E52]">
              Venue & Organizer
            </p>
            <h2 className="mt-2 font-serif text-3xl sm:text-4xl font-semibold text-[#242424]">
              {FESTIVAL_INFO.venue}
            </h2>
            <p className="mt-3 text-[#525252] leading-relaxed">
              {FESTIVAL_INFO.venueAddress}
            </p>

            <dl className="mt-8 border-t border-[#EAE5DC] divide-y divide-[#EAE5DC] text-sm">
              <div className="py-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
                <dt className="font-medium text-[#737373]">Organized By</dt>
                <dd className="sm:col-span-2 text-[#242424]">
                  {FESTIVAL_INFO.organizer}, {FESTIVAL_INFO.organizerAddress}
                </dd>
              </div>
              <div className="py-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
                <dt className="font-medium text-[#737373]">Dates</dt>
                <dd className="sm:col-span-2 text-[#242424]">{FESTIVAL_INFO.duration}</dd>
              </div>
              <div className="py-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
                <dt className="font-medium text-[#737373]">Seating & Entry</dt>
                <dd className="sm:col-span-2 text-[#242424]">
                  150 numbered seats per evening. Doors open 30 minutes before the first concert.
                  Present your digital or printed QR ticket at the entrance.
                </dd>
              </div>
            </dl>

            <div className="mt-8">
              <Link
                to="/book"
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 text-xs font-medium tracking-[0.16em] uppercase bg-[#242424] text-[#FAF8F4] hover:bg-[#383838] transition-colors"
              >
                Book Your Seats Now
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          <div className="lg:col-span-6">
            <figure className="bg-white border border-[#EAE5DC] p-3">
              <div className="aspect-[16/9] overflow-hidden bg-[#EAE5DC]">
                <img
                  src="/src/assets/images/venue_sabha_stage_1794732256852.jpg"
                  alt="Warm teakwood auditorium stage lit with brass oil lamps"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
              <figcaption className="mt-2.5 text-xs text-[#737373] font-serif italic">
                Intimate 150-seat acoustic sabha auditorium · Virugambakkam, Chennai
              </figcaption>
            </figure>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
