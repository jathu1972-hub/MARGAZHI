import { useEffect, useState } from 'react';
import type { AdminAuditLogRow, FestivalDateDTO } from '../../shared/types';
import {
  adminUpdateDateStatus,
  fetchAdminAuditLogs,
  fetchAdminOverview,
} from '../../utils/api';
import { AdminLayout } from './AdminLayout';

export function AdminSettingsPage() {
  const [dates, setDates] = useState<FestivalDateDTO[]>([]);
  const [logs, setLogs] = useState<AdminAuditLogRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadSettingsData = async () => {
    const [ov, auditLogs] = await Promise.all([fetchAdminOverview(), fetchAdminAuditLogs()]);
    setDates(ov.dates);
    setLogs(auditLogs);
  };

  useEffect(() => {
    loadSettingsData();
  }, []);

  const handleToggleDate = async (d: FestivalDateDTO) => {
    setBusyId(d.id);
    try {
      const nextStatus = d.bookingStatus === 'open' ? 'closed' : 'open';
      await adminUpdateDateStatus(d.id, nextStatus);
      await loadSettingsData();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AdminLayout
      title="Settings & Audit Log"
      subtitle="Manage booking availability per festival evening and review security audit logs"
    >
      <div className="space-y-8">
        {/* Per-Date Booking Toggle */}
        <section className="bg-white border border-[#EAE5DC] p-6">
          <h2 className="font-serif text-2xl font-semibold text-[#242424] pb-4 border-b border-[#EAE5DC]">
            Date Booking Availability
          </h2>

          <div className="mt-4 divide-y divide-[#EAE5DC]">
            {dates.map((d) => (
              <div
                key={d.id}
                className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <p className="font-medium text-sm text-[#242424]">
                    Day {d.dayNumber} · {d.dayName}, {d.dateNumber} {d.monthFull} {d.year}
                  </p>
                  <p className="text-xs text-[#737373] tabular-nums">
                    {d.bookedCount}/{d.capacity} booked · Status:{' '}
                    <strong className="uppercase">{d.bookingStatus}</strong>
                  </p>
                </div>

                <button
                  type="button"
                  disabled={busyId === d.id}
                  onClick={() => handleToggleDate(d)}
                  className={`px-4 py-2 text-xs font-medium tracking-[0.12em] uppercase border transition-colors whitespace-nowrap ${
                    d.bookingStatus === 'open'
                      ? 'border-[#EAE5DC] bg-[#FAF8F4] text-[#242424] hover:border-red-300'
                      : 'border-[#242424] bg-[#242424] text-white'
                  }`}
                >
                  {d.bookingStatus === 'open' ? 'Close Booking' : 'Reopen Booking'}
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Audit Log */}
        <section className="bg-white border border-[#EAE5DC] p-6">
          <h2 className="font-serif text-2xl font-semibold text-[#242424] pb-4 border-b border-[#EAE5DC]">
            Administrative Audit Log
          </h2>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#EAE5DC] text-[11px] font-medium uppercase tracking-[0.12em] text-[#737373]">
                  <th className="py-2.5 pr-4">Timestamp</th>
                  <th className="py-2.5 pr-4">Action</th>
                  <th className="py-2.5 pr-4">Target</th>
                  <th className="py-2.5">Metadata</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAE5DC]">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-[#737373]">
                      No administrative actions recorded yet.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id}>
                      <td className="py-2.5 pr-4 font-mono whitespace-nowrap tabular-nums">
                        {new Date(log.timestamp).toLocaleString('en-IN')}
                      </td>
                      <td className="py-2.5 pr-4 font-medium">{log.action}</td>
                      <td className="py-2.5 pr-4 font-mono">{log.targetId ?? '—'}</td>
                      <td className="py-2.5 font-mono text-[#737373]">
                        {JSON.stringify(log.metadata)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AdminLayout>
  );
}
