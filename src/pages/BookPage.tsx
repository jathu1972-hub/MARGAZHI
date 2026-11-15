import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  Clock,
  MapPin,
  Users,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PublicLayout } from '../components/Layout';
import { FESTIVAL_INFO } from '../shared/festivalSchedule';
import { normalizeIndianPhone } from '../shared/seatAllocation';
import type { FestivalDateDTO } from '../shared/types';
import { GENDER_OPTIONS } from '../shared/validation';
import { fetchFestivalDates, submitBooking } from '../utils/api';

function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `mrg-${crypto.randomUUID()}`;
  }
  return `mrg-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export function BookPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [dates, setDates] = useState<FestivalDateDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [focusedId, setFocusedId] = useState<string>('');
  const [step, setStep] = useState<'dates' | 'form'>('dates');

  // Form state
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [gender, setGender] = useState<(typeof GENDER_OPTIONS)[number]>('Male');
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => generateIdempotencyKey());

  const refreshDates = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await fetchFestivalDates();
      setDates(data);
      const queryDate = searchParams.get('date');
      if (queryDate && data.some((d) => d.id === queryDate)) {
        setFocusedId(queryDate);
        const target = data.find((d) => d.id === queryDate);
        if (target && target.remainingSeats > 0 && target.bookingStatus === 'open') {
          setSelectedIds((prev) => (prev.length === 0 ? [queryDate] : prev));
        }
      } else if (data.length > 0) {
        setFocusedId((prev) => prev || data[0].id);
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to load availability.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshDates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const focusedDate = useMemo(
    () => dates.find((d) => d.id === focusedId) ?? dates[0] ?? null,
    [dates, focusedId]
  );

  const selectedDates = useMemo(
    () => dates.filter((d) => selectedIds.includes(d.id)),
    [dates, selectedIds]
  );

  const toggleDate = (date: FestivalDateDTO) => {
    setFocusedId(date.id);
    if (date.remainingSeats === 0 || date.bookingStatus === 'closed') return;
    setSelectedIds((prev) =>
      prev.includes(date.id) ? prev.filter((id) => id !== date.id) : [...prev, date.id]
    );
    // Reset idempotency key when selection changes so it represents a new booking intent
    setIdempotencyKey(generateIdempotencyKey());
  };

  const selectAllAvailable = () => {
    const openIds = dates
      .filter((d) => d.remainingSeats > 0 && d.bookingStatus === 'open')
      .map((d) => d.id);
    setSelectedIds(openIds);
    setIdempotencyKey(generateIdempotencyKey());
  };

  const handleContinueToForm = () => {
    if (selectedIds.length === 0) return;
    setFormError(null);
    setStep('form');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    const trimmedName = fullName.trim();
    const trimmedAddress = address.trim();
    if (trimmedName.length < 2) {
      setFormError('Please enter your full name.');
      return;
    }
    if (!normalizeIndianPhone(phone)) {
      setFormError('Please enter a valid 10-digit Indian mobile number (starting with 6–9).');
      return;
    }
    if (trimmedAddress.length < 5) {
      setFormError('Please enter your complete residential address.');
      return;
    }
    if (!consent) {
      setFormError('Please confirm your consent to complete registration.');
      return;
    }
    if (selectedIds.length === 0) {
      setFormError('Please select at least one festival date.');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      const result = await submitBooking({
        fullName: trimmedName,
        phone: phone.trim(),
        address: trimmedAddress,
        gender,
        consent: true,
        dateIds: selectedIds,
        idempotencyKey,
      });

      navigate(
        `/booking/success?id=${encodeURIComponent(result.booking.bookingId)}&access=${encodeURIComponent(result.booking.accessToken)}`,
        { state: { booking: result.booking } }
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to confirm booking.';
      setFormError(message);
      await refreshDates();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PublicLayout>
      {/* Page Title Banner */}
      <section className="border-b border-[#EAE5DC] bg-white py-8 sm:py-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium tracking-[0.18em] uppercase text-[#977E52]">
              {step === 'dates' ? 'Step 1 of 2 · Select Dates' : 'Step 2 of 2 · Attendee Details'}
            </p>
            <h1 className="mt-2 font-serif text-3xl sm:text-4xl font-semibold text-[#242424]">
              {step === 'dates' ? 'Select Festival Dates' : 'Complete Your Registration'}
            </h1>
          </div>
          {step === 'dates' && dates.length > 0 && (
            <div className="flex items-center gap-3 text-xs">
              <button
                type="button"
                onClick={selectAllAvailable}
                className="px-3 py-1.5 border border-[#EAE5DC] bg-[#FAF8F4] text-[#242424] hover:border-[#B49A6C] transition-colors whitespace-nowrap"
              >
                Select All Open Dates
              </button>
              {selectedIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedIds([])}
                  className="px-3 py-1.5 text-[#737373] hover:text-[#242424] transition-colors whitespace-nowrap"
                >
                  Clear ({selectedIds.length})
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      {loadError && (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
          <div className="border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900 flex items-center justify-between gap-4">
            <span className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {loadError}
            </span>
            <button
              type="button"
              onClick={refreshDates}
              className="text-xs font-medium underline whitespace-nowrap"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {step === 'dates' ? (
        <section className="py-8 sm:py-10 pb-28">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            {loading ? (
              <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-8">
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-20 bg-[#EAE5DC]/50 animate-pulse border border-[#EAE5DC]" />
                  ))}
                </div>
                <div className="h-96 bg-[#EAE5DC]/40 animate-pulse border border-[#EAE5DC]" />
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-8 items-start">
                {/* Mobile Horizontal Date Strip */}
                <div className="lg:hidden">
                  <p className="text-xs text-[#737373] mb-2.5">
                    Tap dates to select one or multiple concerts:
                  </p>
                  <div
                    role="list"
                    aria-label="Festival dates"
                    className="flex gap-2.5 overflow-x-auto pb-2 -mx-4 px-4 snap-x"
                  >
                    {dates.map((date) => {
                      const isSelected = selectedIds.includes(date.id);
                      const isFocused = focusedDate?.id === date.id;
                      const unavailable = date.remainingSeats === 0 || date.bookingStatus === 'closed';
                      return (
                        <button
                          key={date.id}
                          type="button"
                          onClick={() => toggleDate(date)}
                          aria-pressed={isSelected}
                          disabled={unavailable}
                          className={`snap-start shrink-0 min-w-[96px] min-h-[78px] px-3 py-2.5 border text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B49A6C] ${
                            isSelected
                              ? 'border-[#B49A6C] bg-[#EAE5DC]/65 text-[#242424]'
                              : isFocused
                                ? 'border-[#242424] bg-white text-[#242424]'
                                : 'border-[#EAE5DC] bg-white text-[#242424]'
                          } ${unavailable ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <span className="block text-[10px] font-medium tracking-[0.14em] uppercase text-[#737373]">
                            {date.dayAbbr}
                          </span>
                          <span className="block font-serif text-2xl font-semibold tabular-nums leading-tight">
                            {date.dateNumber}
                          </span>
                          <span className="block text-[10px] font-medium tracking-[0.12em] uppercase text-[#977E52]">
                            {date.monthAbbr} · {date.remainingSeats} left
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Desktop Vertical Date Sidebar */}
                <div className="hidden lg:block space-y-2.5">
                  {dates.map((date) => {
                    const isSelected = selectedIds.includes(date.id);
                    const isFocused = focusedDate?.id === date.id;
                    const unavailable = date.remainingSeats === 0 || date.bookingStatus === 'closed';

                    return (
                      <motion.div
                        key={date.id}
                        layout="position"
                        transition={{ duration: 0.16 }}
                        className={`border overflow-hidden transition-colors ${
                          isSelected
                            ? 'border-[#B49A6C] bg-[#EAE5DC]/50'
                            : isFocused
                              ? 'border-[#242424] bg-white'
                              : 'border-[#EAE5DC] bg-white hover:border-[#B49A6C]/70'
                        }`}
                      >
                        <div className="flex items-stretch min-w-0">
                          <button
                            type="button"
                            onClick={() => setFocusedId(date.id)}
                            className="flex-1 min-w-0 overflow-hidden px-4 py-3 text-left flex items-center gap-3.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#B49A6C]"
                          >
                            <div className="w-12 text-center shrink-0">
                              <span className="block text-[10px] font-medium tracking-[0.14em] uppercase text-[#737373]">
                                {date.dayAbbr}
                              </span>
                              <span className="block font-serif text-3xl font-semibold text-[#242424] leading-none tabular-nums">
                                {date.dateNumber}
                              </span>
                              <span className="block text-[10px] font-medium tracking-[0.14em] uppercase text-[#977E52] mt-0.5">
                                {date.monthAbbr}
                              </span>
                            </div>

                            <div className="min-w-0 flex-1 border-l border-[#EAE5DC] pl-4">
                              <p className="text-xs font-medium text-[#737373]">
                                Day {date.dayNumber} ·{' '}
                                <span className="tabular-nums">
                                  {date.bookingStatus === 'closed'
                                    ? 'Closed'
                                    : date.remainingSeats === 0
                                      ? 'Sold Out'
                                      : `${date.remainingSeats} seats left`}
                                </span>
                              </p>
                              <p className="mt-0.5 text-sm font-medium text-[#242424] truncate">
                                {date.title}
                              </p>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => toggleDate(date)}
                            disabled={unavailable}
                            aria-label={
                              isSelected
                                ? `Deselect ${date.dayName} ${date.dateNumber} ${date.monthAbbr}`
                                : `Select ${date.dayName} ${date.dateNumber} ${date.monthAbbr}`
                            }
                            aria-pressed={isSelected}
                            className={`w-14 shrink-0 border-l border-[#EAE5DC] flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#B49A6C] ${
                              unavailable
                                ? 'opacity-40 cursor-not-allowed bg-[#FAF8F4]'
                                : isSelected
                                  ? 'bg-[#B49A6C] text-white'
                                  : 'bg-[#FAF8F4] text-[#737373] hover:text-[#242424]'
                            }`}
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                {/* Right Concert Details Panel */}
                {focusedDate && (
                  <div className="bg-white border border-[#EAE5DC] p-6 sm:p-7 lg:sticky lg:top-20">
                    <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-[#EAE5DC]">
                      <div>
                        <p className="text-xs font-medium tracking-[0.16em] uppercase text-[#977E52]">
                          Day {focusedDate.dayNumber} of 9 · {focusedDate.dayName}
                        </p>
                        <h2 className="mt-1 font-serif text-3xl font-semibold text-[#242424]">
                          {focusedDate.dateNumber} {focusedDate.monthFull} {focusedDate.year}
                        </h2>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-left sm:text-right">
                          <p className="text-[11px] font-medium tracking-[0.12em] uppercase text-[#737373]">
                            Availability
                          </p>
                          <p className="mt-0.5 font-serif text-2xl font-semibold text-[#242424] tabular-nums">
                            {focusedDate.remainingSeats} / {focusedDate.capacity}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => toggleDate(focusedDate)}
                          disabled={
                            focusedDate.remainingSeats === 0 || focusedDate.bookingStatus === 'closed'
                          }
                          className={`px-5 py-2.5 text-xs font-medium tracking-[0.14em] uppercase transition-colors whitespace-nowrap disabled:opacity-40 ${
                            selectedIds.includes(focusedDate.id)
                              ? 'border border-[#B49A6C] bg-[#EAE5DC]/60 text-[#242424]'
                              : 'bg-[#242424] text-[#FAF8F4] hover:bg-[#383838]'
                          }`}
                        >
                          {focusedDate.bookingStatus === 'closed'
                            ? 'Booking Closed'
                            : focusedDate.remainingSeats === 0
                              ? 'Date Sold Out'
                              : selectedIds.includes(focusedDate.id)
                                ? 'Selected'
                                : 'Select Date'}
                        </button>
                      </div>
                    </div>

                    <div className="mt-5 space-y-5">
                      {focusedDate.sessions.map((session, idx) => (
                        <div
                          key={session.id}
                          className={idx > 0 ? 'pt-4 border-t border-[#EAE5DC]' : ''}
                        >
                          <div className="flex items-center gap-2 text-xs font-medium text-[#977E52]">
                            <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>
                              {session.startTime} – {session.endTime}
                            </span>
                          </div>
                          <h3 className="mt-1 font-serif text-xl sm:text-2xl font-semibold text-[#242424]">
                            {session.title}
                          </h3>
                          <ul className="mt-2 space-y-1 text-sm text-[#525252]">
                            {session.performers.map((p) => (
                              <li key={p}>{p}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>

                    <div className="mt-5 pt-4 border-t border-[#EAE5DC] space-y-1.5 text-xs text-[#737373]">
                      <p className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-[#B49A6C] shrink-0" />
                        <span>
                          {FESTIVAL_INFO.venue}, {FESTIVAL_INFO.venueAddress}
                        </span>
                      </p>
                      <p className="flex items-center gap-2">
                        <Users className="w-3.5 h-3.5 text-[#B49A6C] shrink-0" />
                        <span>
                          Automatic seat allocation assigns the same seat number across your selected
                          dates whenever available.
                        </span>
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sticky Selection Summary Bar (<= 15% mobile height) */}
          <div className="fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-sm border-t border-[#B49A6C]/50 shadow-sm">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 sm:py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold tracking-[0.1em] uppercase text-[#242424] tabular-nums whitespace-nowrap">
                  {selectedDates.length === 0
                    ? '0 Dates Selected'
                    : `${selectedDates.length} ${selectedDates.length === 1 ? 'Date' : 'Dates'} Selected`}
                </p>
                <p className="text-xs text-[#737373] truncate">
                  {selectedDates.length === 0
                    ? 'Tap any date to begin'
                    : selectedDates.map((d) => `${d.dateNumber} ${d.monthAbbr}`).join(' · ')}
                </p>
              </div>

              <button
                type="button"
                onClick={handleContinueToForm}
                disabled={selectedDates.length === 0}
                className="inline-flex items-center gap-1.5 px-4 sm:px-5 py-2.5 text-[11px] sm:text-xs font-medium tracking-[0.12em] uppercase bg-[#242424] text-[#FAF8F4] hover:bg-[#383838] disabled:bg-[#EAE5DC] disabled:text-[#737373] disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0"
              >
                <span className="sm:hidden">Continue</span>
                <span className="hidden sm:inline">Continue to Registration</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </section>
      ) : (
        /* Step 2: Registration Form */
        <section className="py-10 sm:py-14">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8 items-start">
            <form
              onSubmit={handleSubmit}
              noValidate
              className="bg-white border border-[#EAE5DC] p-6 sm:p-8 space-y-6"
            >
              <div>
                <button
                  type="button"
                  onClick={() => setStep('dates')}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[#737373] hover:text-[#242424] transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Edit Selected Dates
                </button>
              </div>

              {formError && (
                <div
                  role="alert"
                  className="border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900 flex items-start gap-2.5"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label htmlFor="reg-full-name" className="block text-xs font-medium tracking-[0.12em] uppercase text-[#525252]">
                  Full Name <span className="text-[#977E52]">*</span>
                </label>
                <input
                  id="reg-full-name"
                  type="text"
                  required
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter attendee full name"
                  className="mt-2 w-full px-3.5 py-2.5 bg-[#FAF8F4] border border-[#EAE5DC] text-sm text-[#242424] focus:outline-none focus:border-[#B49A6C]"
                />
              </div>

              <div>
                <label htmlFor="reg-phone" className="block text-xs font-medium tracking-[0.12em] uppercase text-[#525252]">
                  Phone Number (India) <span className="text-[#977E52]">*</span>
                </label>
                <input
                  id="reg-phone"
                  type="tel"
                  required
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="10-digit mobile number (e.g., 9876543210)"
                  className="mt-2 w-full px-3.5 py-2.5 bg-[#FAF8F4] border border-[#EAE5DC] text-sm text-[#242424] focus:outline-none focus:border-[#B49A6C]"
                />
              </div>

              <div>
                <label htmlFor="reg-address" className="block text-xs font-medium tracking-[0.12em] uppercase text-[#525252]">
                  Residential Address <span className="text-[#977E52]">*</span>
                </label>
                <textarea
                  id="reg-address"
                  required
                  rows={3}
                  autoComplete="street-address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Door no, street, locality, city, PIN"
                  className="mt-2 w-full px-3.5 py-2.5 bg-[#FAF8F4] border border-[#EAE5DC] text-sm text-[#242424] focus:outline-none focus:border-[#B49A6C]"
                />
              </div>

              <div>
                <label htmlFor="reg-gender" className="block text-xs font-medium tracking-[0.12em] uppercase text-[#525252]">
                  Gender <span className="text-[#977E52]">*</span>
                </label>
                <select
                  id="reg-gender"
                  value={gender}
                  onChange={(e) => setGender(e.target.value as (typeof GENDER_OPTIONS)[number])}
                  className="mt-2 w-full px-3.5 py-2.5 bg-[#FAF8F4] border border-[#EAE5DC] text-sm text-[#242424] focus:outline-none focus:border-[#B49A6C]"
                >
                  {GENDER_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    id="reg-consent"
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-1 h-4 w-4 accent-[#242424]"
                  />
                  <span className="text-xs sm:text-sm text-[#525252] leading-relaxed">
                    I agree to the use of my information for MARGAZHI event registration and ticket
                    management.
                  </span>
                </label>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3.5 px-6 text-xs font-medium tracking-[0.16em] uppercase bg-[#242424] text-[#FAF8F4] hover:bg-[#383838] disabled:opacity-60 transition-colors"
                >
                  {submitting ? 'Allocating Seats & Confirming...' : 'Confirm My Booking'}
                </button>
              </div>
            </form>

            {/* Selected Dates Summary Sidebar */}
            <aside className="bg-white border border-[#EAE5DC] p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-[#EAE5DC] pb-3">
                <h2 className="font-serif text-xl font-semibold text-[#242424]">
                  Selected Dates ({selectedDates.length})
                </h2>
                <button
                  type="button"
                  onClick={() => setStep('dates')}
                  className="text-xs font-medium text-[#977E52] hover:text-[#242424] underline"
                >
                  Edit Dates
                </button>
              </div>

              <ul className="divide-y divide-[#EAE5DC] text-sm">
                {selectedDates.map((d) => (
                  <li key={d.id} className="py-3">
                    <p className="font-medium text-[#242424]">
                      {d.dayName}, {d.dateNumber} {d.monthFull} {d.year}
                    </p>
                    <p className="mt-0.5 text-xs text-[#737373]">{d.title}</p>
                  </li>
                ))}
              </ul>
            </aside>
          </div>
        </section>
      )}
    </PublicLayout>
  );
}
