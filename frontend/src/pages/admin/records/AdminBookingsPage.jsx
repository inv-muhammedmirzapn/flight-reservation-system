/**
 * AdminBookingsPage — searchable by PNR, filterable by status, detail view.
 */
import { useEffect, useState } from 'react';
import { fetchWithAuth } from '@/services/apiClient';
import { Search, AlertCircle, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import '@/styles/admin-system.css';

const STATUS_COLORS = {
  CONFIRMED: '#22c55e', PENDING_PAYMENT: '#f59e0b', CREATED: '#3b82f6',
  CANCELLED: '#ef4444', EXPIRED: '#6b7280', REFUNDED: '#8b5cf6',
};

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const [selected, setSelected] = useState(null);
  const PAGE_SIZE = 20;

  const load = async (s, st, p) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: p, page_size: PAGE_SIZE });
      if (s) params.set('pnr', s);
      if (st) params.set('status', st);
      const data = await fetchWithAuth(`/bookings/?${params}`);
      setBookings(data.results || data);
      setCount(data.count || (data.results ? data.results.length : data.length));
    } catch (err) {
      setError(String(err.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(search, statusFilter, page); }, []);

  const handleSearch = (e) => { e.preventDefault(); setPage(1); load(search, statusFilter, 1); };

  const STATUS_OPTIONS = ['', 'CONFIRMED', 'PENDING_PAYMENT', 'CREATED', 'CANCELLED', 'EXPIRED', 'REFUNDED'];
  const totalPages = Math.ceil(count / PAGE_SIZE) || 1;

  return (
    <>
      <style>{`
        .detail-card { background:#fff; border-radius:18px; padding:28px; box-shadow:0 12px 40px rgba(0,0,0,0.12); margin-top:24px; }
        .kv { display:grid; grid-template-columns:auto 1fr; gap:6px 20px; font-size:13px; }
        .kv dt { font-weight:700; color:#888; }
        .kv dd { color:#1a1c1d; margin:0; }
      `}</style>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '88px 24px 48px' }}>
        <h1 style={{ fontFamily: "'Plus Jakarta Sans', Inter, sans-serif", fontSize: 28, fontWeight: 800, color: '#1a1c1d', marginBottom: 8 }}>Bookings</h1>
        <p style={{ color: '#888', fontSize: 14, marginBottom: 24 }}>Search by PNR and filter by booking status.</p>

        <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#888' }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search PNR…"
              style={{ width: '100%', padding: '9px 12px 9px 32px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.12)', fontSize: 13, outline: 'none', background: 'rgba(255,255,255,0.8)' }} />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            style={{ padding: '9px 14px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.12)', fontSize: 13, background: '#fff', outline: 'none' }}>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s || 'All statuses'}</option>)}
          </select>
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
          ) : bookings.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48, color: '#888', fontSize: 14 }}>No bookings found.</div>
          ) : (
            <table className="admin-table">
              <thead><tr><th>PNR</th><th>User</th><th>Status</th><th>Price Paid</th><th>Created</th></tr></thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b.id} onClick={() => setSelected(selected?.id === b.id ? null : b)}>
                    <td><strong>{b.pnr || b.id?.slice?.(0, 8)}</strong></td>
                    <td>{b.user || b.user_id || '—'}</td>
                    <td>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: (STATUS_COLORS[b.status] || '#888') + '20', color: STATUS_COLORS[b.status] || '#888' }}>
                        {b.status || b.booking_status}
                      </span>
                    </td>
                    <td>{b.total_price_paid ?? b.total_price ?? '—'}</td>
                    <td>{b.created_at ? new Date(b.created_at).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 20 }}>
            <button className="btn-secondary" disabled={page === 1} onClick={() => { setPage(page - 1); load(search, statusFilter, page - 1); }}><ChevronLeft size={15} /> Prev</button>
            <span style={{ lineHeight: '34px', fontSize: 13, color: '#888' }}>Page {page} / {totalPages}</span>
            <button className="btn-secondary" disabled={page === totalPages} onClick={() => { setPage(page + 1); load(search, statusFilter, page + 1); }}>Next <ChevronRight size={15} /></button>
          </div>
        )}

        {/* Detail */}
        {selected && (
          <div className="detail-card">
            <h3 style={{ fontWeight: 800, fontSize: 16, marginBottom: 16, color: '#1a1c1d' }}>Booking Detail</h3>
            <dl className="kv">
              <dt>ID</dt><dd>{selected.id}</dd>
              <dt>PNR</dt><dd>{selected.pnr || '—'}</dd>
              <dt>Status</dt><dd>{selected.status || selected.booking_status}</dd>
              <dt>Total Price</dt><dd>{selected.total_price_paid ?? selected.total_price ?? '—'}</dd>
              <dt>Created</dt><dd>{selected.created_at ? new Date(selected.created_at).toLocaleString() : '—'}</dd>
              {selected.passengers && <>
                <dt>Passengers</dt>
                <dd>{selected.passengers.map((p) => p.name || p.full_name).join(', ')}</dd>
              </>}
            </dl>
          </div>
        )}
      </div>
    </>
  );
}
