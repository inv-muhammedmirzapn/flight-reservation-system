/**
 * AdminPaymentsPage — list + detail, linked to booking.
 */
import { useEffect, useState } from 'react';
import { fetchWithAuth } from '@/services/apiClient';
import { Search, AlertCircle } from 'lucide-react';
import { Pagination } from '@/components/ui/Pagination';
import '@/styles/admin-system.css';

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
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load('', 1); }, []);

  const totalPages = Math.ceil(count / PAGE_SIZE) || 1;

  const STATUS_COLORS = { SUCCESS: '#22c55e', FAILED: '#ef4444', PENDING: '#f59e0b', REFUNDED: '#8b5cf6' };

  return (
    <>
      <style>{`
        .detail-card { background:#fff; border-radius:18px; padding:28px; box-shadow:0 12px 40px rgba(0,0,0,0.12); margin-top:24px; }
        .kv { display:grid; grid-template-columns:auto 1fr; gap:6px 20px; font-size:13px; }
        .kv dt { font-weight:700; color:#888; }
        .kv dd { color:#1a1c1d; margin:0; }
      `}</style>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '88px 24px 48px' }}>
        <h1 style={{ fontFamily: "'Plus Jakarta Sans', Inter, sans-serif", fontSize: 28, fontWeight: 800, color: '#1a1c1d', marginBottom: 8 }}>Payments</h1>
        <p style={{ color: '#888', fontSize: 14, marginBottom: 24 }}>View payment records linked to bookings.</p>

        <form onSubmit={(e) => { e.preventDefault(); setPage(1); load(search, 1); }} style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#888' }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by transaction ID…"
              style={{ width: '100%', padding: '9px 12px 9px 32px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.12)', fontSize: 13, outline: 'none', background: 'rgba(255,255,255,0.8)' }} />
          </div>
          <button type="submit" className="btn-primary" style={{ padding: '9px 16px' }}>Search</button>
        </form>

        {error && (
          <div style={{ display: 'flex', gap: 8, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '12px 16px', color: '#b91c1c', marginBottom: 20, fontSize: 13 }}>
            <AlertCircle size={15} /><span>{error}</span>
          </div>
        )}

        <div className="admin-card admin-table-wrap">
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
              <div style={{ width: 36, height: 36, border: '3px solid rgba(112,93,0,0.15)', borderTopColor: '#705d00', borderRadius: '50%', animation: 'spin 0.75s linear infinite' }} />
            </div>
          ) : payments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48, color: '#888', fontSize: 14 }}>No payments found.</div>
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
    </>
  );
}
