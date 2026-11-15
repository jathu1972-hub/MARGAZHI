import { ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { PublicLayout } from '../components/Layout';
import { TicketCard } from '../components/TicketCard';
import type { PublicTicketDTO } from '../shared/types';
import { fetchPublicTicket } from '../utils/api';

export function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [ticket, setTicket] = useState<PublicTicketDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let active = true;
    fetchPublicTicket(id, token)
      .then((data) => {
        if (active) setTicket(data);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Unable to load ticket.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id, token]);

  return (
    <PublicLayout>
      <section className="py-10 sm:py-14">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="no-print">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#737373] hover:text-[#242424]"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to MARGAZHI
            </Link>
          </div>

          {loading ? (
            <div className="h-80 bg-[#EAE5DC]/50 animate-pulse border border-[#EAE5DC]" />
          ) : error || !ticket ? (
            <div className="bg-white border border-[#EAE5DC] p-8 text-center">
              <h1 className="font-serif text-3xl font-semibold text-[#242424]">
                Ticket Access Restricted
              </h1>
              <p className="mt-2 text-sm text-[#737373]">
                {error || 'A valid verification token is required to view this ticket.'}
              </p>
            </div>
          ) : (
            <TicketCard ticket={ticket} showOpenLink={false} />
          )}
        </div>
      </section>
    </PublicLayout>
  );
}
