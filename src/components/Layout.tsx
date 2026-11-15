import { Menu, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FESTIVAL_INFO } from '../shared/festivalSchedule';

interface LayoutProps {
  children: ReactNode;
}

const NAV_ITEMS = [
  { label: 'Home', to: '/' },
  { label: 'Festival Schedule', to: '/schedule' },
  { label: 'Book Tickets', to: '/book' },
  { label: 'About', to: '/#about' },
  { label: 'Contact', to: '/#contact' },
];

export function PublicLayout({ children }: LayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const isActive = (to: string) => {
    if (to === '/') return location.pathname === '/' && !location.hash;
    if (to.startsWith('/#')) return location.pathname === '/' && location.hash === to.slice(1);
    return location.pathname.startsWith(to);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF8F4] text-[#242424]">
      <header className="sticky top-0 z-40 bg-[#FAF8F4]/95 backdrop-blur-sm border-b border-[#EAE5DC] no-print">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <Link
            to="/"
            className="font-serif text-2xl sm:text-[26px] font-semibold tracking-[0.14em] text-[#242424] whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B49A6C] rounded-sm"
          >
            MARGAZHI
          </Link>

          {/* Zone 2: 5 concise single-line navigation links */}
          <nav
            aria-label="Primary navigation"
            className="hidden lg:flex items-center gap-7 text-sm font-medium text-[#525252]"
          >
            {NAV_ITEMS.map((item) => {
              const active = isActive(item.to);
              if (item.to.startsWith('/#')) {
                return (
                  <a
                    key={item.label}
                    href={item.to}
                    className={`whitespace-nowrap shrink-0 py-1 border-b transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B49A6C] ${
                      active
                        ? 'text-[#242424] border-[#B49A6C]'
                        : 'border-transparent hover:text-[#242424] hover:border-[#B49A6C]/50'
                    }`}
                  >
                    {item.label}
                  </a>
                );
              }
              return (
                <Link
                  key={item.label}
                  to={item.to}
                  className={`whitespace-nowrap shrink-0 py-1 border-b transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B49A6C] ${
                    active
                      ? 'text-[#242424] border-[#B49A6C]'
                      : 'border-transparent hover:text-[#242424] hover:border-[#B49A6C]/50'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Zone 3: 1 Primary CTA + Mobile hamburger */}
          <div className="flex items-center gap-3 shrink-0">
            <Link
              to="/book"
              className="hidden sm:inline-flex items-center justify-center px-5 py-2 text-xs font-medium tracking-[0.14em] uppercase bg-[#242424] text-[#FAF8F4] hover:bg-[#383838] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B49A6C] focus-visible:ring-offset-2"
            >
              Book Seats
            </Link>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-expanded={mobileMenuOpen}
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              className="lg:hidden inline-flex items-center justify-center w-11 h-11 text-[#242424] border border-[#EAE5DC] bg-white hover:bg-[#EAE5DC]/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B49A6C]"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile drawer */}
        {mobileMenuOpen && (
          <nav
            aria-label="Mobile navigation"
            className="lg:hidden border-t border-[#EAE5DC] bg-[#FAF8F4] px-4 py-4 space-y-1"
          >
            {NAV_ITEMS.map((item) =>
              item.to.startsWith('/#') ? (
                <a
                  key={item.label}
                  href={item.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-3 text-sm font-medium text-[#242424] hover:bg-[#EAE5DC]/50 transition-colors"
                >
                  {item.label}
                </a>
              ) : (
                <Link
                  key={item.label}
                  to={item.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-3 text-sm font-medium text-[#242424] hover:bg-[#EAE5DC]/50 transition-colors"
                >
                  {item.label}
                </Link>
              )
            )}
            <div className="pt-2">
              <Link
                to="/book"
                onClick={() => setMobileMenuOpen(false)}
                className="block w-full text-center px-5 py-3 text-xs font-medium tracking-[0.14em] uppercase bg-[#242424] text-[#FAF8F4]"
              >
                Book Your Seat
              </Link>
            </div>
          </nav>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-[#EAE5DC] bg-[#FAF8F4] py-12 px-4 sm:px-6 lg:px-8 no-print">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 text-sm">
          <div>
            <p className="font-serif text-xl font-semibold tracking-[0.12em] text-[#242424]">
              MARGAZHI
            </p>
            <p className="mt-2 text-[#737373] leading-relaxed">
              {FESTIVAL_INFO.edition}
              <br />
              {FESTIVAL_INFO.organizer}, {FESTIVAL_INFO.organizerAddress}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium tracking-[0.14em] uppercase text-[#737373]">
              Festival Venue
            </p>
            <p className="mt-2 text-[#242424] leading-relaxed">
              {FESTIVAL_INFO.venue}
              <br />
              {FESTIVAL_INFO.venueAddress}
              <br />
              {FESTIVAL_INFO.duration}
            </p>
          </div>
          <div className="md:text-right space-y-2">
            <p className="text-xs font-medium tracking-[0.14em] uppercase text-[#737373]">
              Festival Portal
            </p>
            <div className="flex flex-wrap md:justify-end gap-x-5 gap-y-2 text-[#525252]">
              <Link to="/schedule" className="hover:text-[#242424] underline-offset-4 hover:underline">
                Schedule
              </Link>
              <Link to="/book" className="hover:text-[#242424] underline-offset-4 hover:underline">
                Book Tickets
              </Link>
              <Link to="/verify" className="hover:text-[#242424] underline-offset-4 hover:underline">
                Verify QR
              </Link>
              <Link to="/admin" className="hover:text-[#242424] underline-offset-4 hover:underline">
                Admin
              </Link>
            </div>
          </div>
        </div>
        <div className="max-w-6xl mx-auto mt-8 pt-6 border-t border-[#EAE5DC] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-[#737373]">
          <span>© 2026 {FESTIVAL_INFO.organizer}. All rights reserved.</span>
          <span>150 Seats Per Evening · Complimentary Registration</span>
        </div>
      </footer>
    </div>
  );
}
