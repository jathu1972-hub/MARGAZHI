import {
  AlertTriangle,
  Calendar,
  Camera,
  CheckCircle2,
  Lock,
  QrCode,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PublicLayout } from '../components/Layout';
import { FESTIVAL_DATES_SEED } from '../shared/festivalSchedule';
import type { VerificationResultDTO } from '../shared/types';
import {
  adminLogin,
  adminLogout,
  checkAdminSession,
  confirmVerificationCheckIn,
  inspectVerification,
} from '../utils/api';

function parseQrInput(raw: string): { ticketId: string; token: string } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    const t = url.searchParams.get('t') || url.searchParams.get('ticketId');
    const k = url.searchParams.get('k') || url.searchParams.get('token');
    if (t && k) return { ticketId: t.trim(), token: k.trim() };
  } catch {
    // not a URL
  }
  return null;
}

export function VerifyPage() {
  const [searchParams] = useSearchParams();
  const [ticketId, setTicketId] = useState(() => searchParams.get('t') ?? '');
  const [token, setToken] = useState(() => searchParams.get('k') ?? '');
  const [referenceDate, setReferenceDate] = useState<string>('');
  const [qrInput, setQrInput] = useState('');

  const [staffAuth, setStaffAuth] = useState(false);
  const [staffPassword, setStaffPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);

  const [result, setResult] = useState<VerificationResultDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraSupported] = useState(
    () => typeof window !== 'undefined' && 'BarcodeDetector' in window && !!navigator.mediaDevices
  );
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const runInspect = async (tId: string, tToken: string, refDate?: string) => {
    if (!tId.trim() || !tToken.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await inspectVerification(tId.trim(), tToken.trim(), refDate || undefined);
      setResult(data);
      setStaffAuth(data.isStaffAuthenticated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to verify ticket.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAdminSession()
      .then((auth) => setStaffAuth(auth))
      .catch(() => {});

    const initialT = searchParams.get('t');
    const initialK = searchParams.get('k');
    if (initialT && initialK) {
      runInspect(initialT, initialK, referenceDate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
    };
  }, []);

  const handleManualInspect = (e: FormEvent) => {
    e.preventDefault();
    const parsedFromUrl = parseQrInput(qrInput);
    if (parsedFromUrl) {
      setTicketId(parsedFromUrl.ticketId);
      setToken(parsedFromUrl.token);
      runInspect(parsedFromUrl.ticketId, parsedFromUrl.token, referenceDate);
      return;
    }
    runInspect(ticketId, token, referenceDate);
  };

  const handleStaffLogin = async (e: FormEvent) => {
    e.preventDefault();
    setAuthBusy(true);
    setAuthError(null);
    try {
      await adminLogin(staffPassword);
      setStaffAuth(true);
      setStaffPassword('');
      if (ticketId && token) {
        await runInspect(ticketId, token, referenceDate);
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Invalid password.');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleStaffLogout = async () => {
    await adminLogout();
    setStaffAuth(false);
    if (ticketId && token) {
      await runInspect(ticketId, token, referenceDate);
    }
  };

  const handleAtomicCheckIn = async () => {
    if (!ticketId || !token) return;
    setCheckingIn(true);
    setError(null);
    try {
      const data = await confirmVerificationCheckIn(ticketId, token);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Check-in failed.');
    } finally {
      setCheckingIn(false);
    }
  };

  const startCameraScan = async () => {
    if (!cameraSupported) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      setCameraActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      // @ts-expect-error BarcodeDetector experimental browser API
      const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
      const scanFrame = async () => {
        if (!videoRef.current || !streamRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes.length > 0 && codes[0].rawValue) {
            const parsed = parseQrInput(codes[0].rawValue);
            if (parsed) {
              stopCameraScan();
              setTicketId(parsed.ticketId);
              setToken(parsed.token);
              runInspect(parsed.ticketId, parsed.token, referenceDate);
              return;
            }
          }
        } catch {
          // ignore frame detection error
        }
        if (streamRef.current) {
          requestAnimationFrame(scanFrame);
        }
      };
      requestAnimationFrame(scanFrame);
    } catch {
      setError('Camera permission denied or unavailable.');
    }
  };

  const stopCameraScan = () => {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
    setCameraActive(false);
  };

  const renderStatusBanner = (res: VerificationResultDTO) => {
    switch (res.verificationStatus) {
      case 'valid':
        return {
          bg: 'bg-emerald-50 border-emerald-300 text-emerald-950',
          label: 'VALID TICKET',
          Icon: CheckCircle2,
        };
      case 'already_checked_in':
        return {
          bg: 'bg-amber-50 border-amber-300 text-amber-950',
          label: 'ALREADY CHECKED IN',
          Icon: AlertTriangle,
        };
      case 'wrong_event_date':
        return {
          bg: 'bg-amber-50 border-amber-300 text-amber-950',
          label: 'WRONG EVENT DATE',
          Icon: Calendar,
        };
      case 'cancelled':
        return {
          bg: 'bg-red-50 border-red-300 text-red-950',
          label: 'CANCELLED TICKET',
          Icon: XCircle,
        };
      default:
        return {
          bg: 'bg-red-50 border-red-300 text-red-950',
          label: 'INVALID TICKET',
          Icon: XCircle,
        };
    }
  };

  return (
    <PublicLayout>
      <section className="border-b border-[#EAE5DC] bg-white py-8 sm:py-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium tracking-[0.18em] uppercase text-[#977E52]">
              Entrance Verification
            </p>
            <h1 className="mt-1.5 font-serif text-3xl sm:text-4xl font-semibold text-[#242424]">
              QR Ticket Verification
            </h1>
          </div>

          <div className="text-xs">
            {staffAuth ? (
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5 font-medium text-[#242424]">
                  <ShieldCheck className="w-4 h-4 text-[#977E52]" />
                  Staff Authorized
                </span>
                <button
                  type="button"
                  onClick={handleStaffLogout}
                  className="text-[#737373] hover:text-[#242424] underline"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[#737373]">
                <Lock className="w-3.5 h-3.5" />
                Public Verification View (Sign in for check-in)
              </span>
            )}
          </div>
        </div>
      </section>

      <section className="py-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: Verification Scanner / Input */}
          <div className="lg:col-span-6 space-y-6">
            <form
              onSubmit={handleManualInspect}
              className="bg-white border border-[#EAE5DC] p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-serif text-xl font-semibold text-[#242424] flex items-center gap-2">
                  <QrCode className="w-5 h-5 text-[#B49A6C]" />
                  Inspect Ticket
                </h2>
                {cameraSupported && (
                  <button
                    type="button"
                    onClick={cameraActive ? stopCameraScan : startCameraScan}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-[#EAE5DC] bg-[#FAF8F4] hover:border-[#B49A6C]"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    {cameraActive ? 'Stop Camera' : 'Scan QR'}
                  </button>
                )}
              </div>

              {cameraActive && (
                <div className="border border-[#EAE5DC] bg-black aspect-video overflow-hidden">
                  <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
                </div>
              )}

              <div>
                <label htmlFor="qr-url-input" className="block text-xs font-medium text-[#525252]">
                  Paste QR Verification Link (optional)
                </label>
                <input
                  id="qr-url-input"
                  type="text"
                  value={qrInput}
                  onChange={(e) => {
                    setQrInput(e.target.value);
                    const parsed = parseQrInput(e.target.value);
                    if (parsed) {
                      setTicketId(parsed.ticketId);
                      setToken(parsed.token);
                    }
                  }}
                  placeholder="https://.../verify?t=MRG-...&k=..."
                  className="mt-1.5 w-full px-3 py-2 bg-[#FAF8F4] border border-[#EAE5DC] text-xs font-mono focus:outline-none focus:border-[#B49A6C]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="verify-ticket-id" className="block text-xs font-medium text-[#525252]">
                    Ticket ID
                  </label>
                  <input
                    id="verify-ticket-id"
                    type="text"
                    required
                    value={ticketId}
                    onChange={(e) => setTicketId(e.target.value)}
                    placeholder="MRG-20261226-0001"
                    className="mt-1.5 w-full px-3 py-2 bg-[#FAF8F4] border border-[#EAE5DC] text-xs font-mono focus:outline-none focus:border-[#B49A6C]"
                  />
                </div>
                <div>
                  <label htmlFor="verify-token" className="block text-xs font-medium text-[#525252]">
                    Verification Token
                  </label>
                  <input
                    id="verify-token"
                    type="text"
                    required
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="Token from QR"
                    className="mt-1.5 w-full px-3 py-2 bg-[#FAF8F4] border border-[#EAE5DC] text-xs font-mono focus:outline-none focus:border-[#B49A6C]"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="verify-ref-date" className="block text-xs font-medium text-[#525252]">
                  Gate Event Date Check (optional)
                </label>
                <select
                  id="verify-ref-date"
                  value={referenceDate}
                  onChange={(e) => setReferenceDate(e.target.value)}
                  className="mt-1.5 w-full px-3 py-2 bg-[#FAF8F4] border border-[#EAE5DC] text-xs focus:outline-none focus:border-[#B49A6C]"
                >
                  <option value="">Any Festival Date</option>
                  {FESTIVAL_DATES_SEED.map((d) => (
                    <option key={d.id} value={d.eventDate}>
                      Day {d.dayNumber} — {d.dayName}, {d.dateNumber} {d.monthAbbr} {d.year}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 text-xs font-medium tracking-[0.14em] uppercase bg-[#242424] text-[#FAF8F4] hover:bg-[#383838] transition-colors disabled:opacity-50"
              >
                {loading ? 'Verifying...' : 'Verify Ticket'}
              </button>
            </form>

            {/* Staff Sign-In Box when not authenticated */}
            {!staffAuth && (
              <form
                onSubmit={handleStaffLogin}
                className="bg-white border border-[#EAE5DC] p-6 space-y-3"
              >
                <h3 className="font-serif text-lg font-semibold text-[#242424]">
                  Event Staff Sign-In
                </h3>
                <p className="text-xs text-[#737373]">
                  Sign in with your administrator password to view attendee names and perform atomic
                  gate check-in.
                </p>
                {authError && (
                  <p className="text-xs text-red-700" role="alert">
                    {authError}
                  </p>
                )}
                <div className="flex gap-2">
                  <input
                    type="password"
                    required
                    value={staffPassword}
                    onChange={(e) => setStaffPassword(e.target.value)}
                    placeholder="Admin password"
                    aria-label="Administrator password"
                    className="flex-1 px-3 py-2 bg-[#FAF8F4] border border-[#EAE5DC] text-sm focus:outline-none focus:border-[#B49A6C]"
                  />
                  <button
                    type="submit"
                    disabled={authBusy}
                    className="px-4 py-2 text-xs font-medium tracking-[0.12em] uppercase bg-[#B49A6C] text-white hover:bg-[#977E52] transition-colors whitespace-nowrap"
                  >
                    {authBusy ? 'Signing In...' : 'Sign In'}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Right: Verification Result Card */}
          <div className="lg:col-span-6">
            {error && (
              <div className="border border-red-300 bg-red-50 p-4 text-sm text-red-900 mb-4">
                {error}
              </div>
            )}

            {result ? (
              (() => {
                const banner = renderStatusBanner(result);
                const Icon = banner.Icon;
                return (
                  <div className="bg-white border border-[#EAE5DC] p-6 space-y-6">
                    <div className={`border p-4 flex items-start gap-3 ${banner.bg}`}>
                      <Icon className="w-5 h-5 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-bold tracking-[0.14em] uppercase">
                          {banner.label}
                        </p>
                        <p className="mt-1 text-sm">{result.message}</p>
                      </div>
                    </div>

                    {result.ticketId && (
                      <dl className="divide-y divide-[#EAE5DC] text-sm">
                        <div className="py-3 flex justify-between gap-4">
                          <dt className="text-[#737373]">Ticket ID</dt>
                          <dd className="font-mono font-medium text-[#242424] tabular-nums">
                            {result.ticketId}
                          </dd>
                        </div>
                        <div className="py-3 flex justify-between gap-4">
                          <dt className="text-[#737373]">Event Date</dt>
                          <dd className="font-medium text-[#242424]">
                            {result.dayName}, {result.eventDate}
                          </dd>
                        </div>
                        <div className="py-3 flex justify-between gap-4">
                          <dt className="text-[#737373]">Seat Number</dt>
                          <dd className="font-serif text-2xl font-semibold text-[#977E52] tabular-nums">
                            {result.seatLabel}
                          </dd>
                        </div>
                        <div className="py-3 flex justify-between gap-4">
                          <dt className="text-[#737373]">Check-in Status</dt>
                          <dd className="font-medium text-[#242424]">
                            {result.checkedInAt
                              ? `Checked in at ${new Date(result.checkedInAt).toLocaleString('en-IN')}`
                              : 'Not yet checked in'}
                          </dd>
                        </div>
                        {result.isStaffAuthenticated && (
                          <div className="py-3 flex justify-between gap-4">
                            <dt className="text-[#737373]">Attendee Name</dt>
                            <dd className="font-medium text-[#242424]">
                              {result.attendeeName ?? '—'}
                            </dd>
                          </div>
                        )}
                      </dl>
                    )}

                    {staffAuth &&
                      !result.checkedInAt &&
                      (result.verificationStatus === 'valid' ||
                        result.verificationStatus === 'wrong_event_date') && (
                        <button
                          type="button"
                          onClick={handleAtomicCheckIn}
                          disabled={checkingIn}
                          className="w-full py-3.5 px-6 text-xs font-medium tracking-[0.16em] uppercase bg-[#242424] text-[#FAF8F4] hover:bg-[#383838] transition-colors disabled:opacity-50"
                        >
                          {checkingIn ? 'Checking In...' : 'Confirm Check-In (Admit Attendee)'}
                        </button>
                      )}
                  </div>
                );
              })()
            ) : (
              <div className="bg-white border border-[#EAE5DC] p-8 text-center text-sm text-[#737373]">
                Scan a MARGAZHI ticket QR code or enter a Ticket ID and token to inspect validity
                and admission status.
              </div>
            )}
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
