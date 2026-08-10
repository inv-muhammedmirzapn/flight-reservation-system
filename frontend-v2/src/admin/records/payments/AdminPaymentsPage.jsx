/**
 * AdminPaymentsPage — list + detail, linked to booking.
 */
import { useEffect, useState } from 'react';
import { fetchWithAuth } from '@/services/apiClient';
import { Search, AlertCircle } from 'lucide-react';
import { Pagination } from '@/components/ui/Pagination';
import '@/admin/_core/styles/admin.css';
import { parseApiError } from '@/utils/errorUtils';

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const [selected, setSelected] = useState(null);
  const PAGE_SIZE = 10;

  const load = async (s, p) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: p, page_size: PAGE_SIZE });
      if (s) params.set('search', s);
      const data = await fetchWithAuth(`/bookings/payments/?${params}`);
      setPayments(data.results || data || []);
      setCount(data.count || (data.results ? data.results.length : (data?.length ?? 0)));
    } catch (err) {
      setError(parseApiError(err, 'Failed to load payments.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load('', 1); }, []);

  const totalPages = Math.ceil(count / PAGE_SIZE) || 1;

  const STATUS_COLORS = { SUCCESS: '#22c55e', FAILED: '#ef4444', PENDING: '#f59e0b', REFUNDED: '#8b5cf6' };

  return (
    <div className="admin-page">
      <div className="admin-container">
        <h1 className="admin-page-title" style={{ marginBottom: 8 }}>Payments</h1>
        <p className="admin-page-subtitle" style={{ marginBottom: 24 }}>View payment records linked to bookings.</p>

        <form onSubmit={(e) => { e.preventDefault(); setPage(1); load(search, 1); }} className="flex gap-2 mb-5">
          <div className="admin-toolbar-search">
            <Search size={14} className="search-icon" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by transaction ID…" />
          </div>
          <button type="submit" className="btn-primary">Search</button>
        </form>

        {error && (
          <div className="admin-error">
            <AlertCircle size={15} /><span>{error}</span>
          </div>
        )}

        <div className="admin-card admin-table-wrap">
          {loading ? (
            <div className="admin-spinner-wrap"><div className="admin-spinner" /></div>
          ) : payments.length === 0 ? (
            <div className="admin-empty"><p>No payments found.</p></div>
          ) : (
            <table className="admin-table">
              <thead><tr><th>Transaction ID</th><th>Gateway</th><th>Amount</th><th>Status</th><th>Paid At</th></tr></thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} onClick={() => setSelected(selected?.id === p.id ? null : p)}>
                    <td><code style={{ fontSize: 12 }}>{p.transaction_id || p.id}</code></td>
                    <td>{p.gateway || '—'}</td>
                    <td>{p.currency} {p.amount}</td>
                    <td>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: (STATUS_COLORS[p.status] || '#888') + '20', color: STATUS_COLORS[p.status] || '#888' }}>
                        {p.status}
                      </span>
                    </td>
                    <td>{p.paid_at ? new Date(p.paid_at).toLocaleString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalCount={count}
          pageSize={PAGE_SIZE}
          onPageChange={(p) => { setPage(p); load(search, p); }}
          entityLabel="payments"
        />

        {selected && (
          <div className="detail-card">
            <h3 style={{ fontWeight: 800, fontSize: 16, marginBottom: 16, color: '#1a1c1d' }}>Payment Detail</h3>
            <dl className="kv">
              {Object.entries(selected).map(([k, v]) => (
                <><dt key={`dt-${k}`}>{k}</dt><dd key={`dd-${k}`}>{String(v)}</dd></>
              ))}
            </dl>
          </div>
        )}
      </div>
    </div>
  );
}
