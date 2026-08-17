/**
 * AdminPaymentsPage — list + detail, linked to booking.
 */
import { useEffect, useState, useCallback, useMemo } from 'react';
import { fetchWithAuth } from '@/services/apiClient';
import { Search, AlertCircle } from 'lucide-react';
import { Pagination } from '@/components/ui/Pagination';
import '@/admin/_core/styles/admin.css';
import { parseApiError } from '@/utils/errorUtils';
import { ADMIN_PAGE_SIZE } from '@/admin/_core/store/adminSlices';

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [searchFocus, setSearchFocus] = useState(false);
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const [selected, setSelected] = useState(null);
  const load = useCallback(async (s, p) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: p });
      if (s) params.set('search', s);
      const data = await fetchWithAuth(`/bookings/payments/?${params}`);
      setPayments(data.results || data || []);
      setCount(data.count || (data.results ? data.results.length : (data?.length ?? 0)));
    } catch (err) {
      setError(parseApiError(err, 'Failed to load payments.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load('', 1); }, [load]);

  const totalPages = Math.ceil(count / ADMIN_PAGE_SIZE) || 1;

  const searchSuggestions = useMemo(() => {
    if (!search || search.trim().length < 2 || !payments) return [];
    const q = search.toLowerCase().trim();
    const map = new Map();
    payments.forEach(p => {
      if (p.transaction_id?.toLowerCase().includes(q)) map.set(p.transaction_id, 'Transaction ID');
      if (p.gateway?.toLowerCase().includes(q)) map.set(p.gateway, 'Gateway');
    });
    return Array.from(map.entries()).map(([value, category]) => ({ value, category })).slice(0, 5);
  }, [search, payments]);

  const STATUS_COLORS = { SUCCESS: '#22c55e', FAILED: '#ef4444', PENDING: '#f59e0b', REFUNDED: '#8b5cf6' };

  return (
    <div className="admin-page">
      <div className="admin-container">
        <h1 className="admin-page-title" style={{ marginBottom: 8 }}>Payments</h1>
        <p className="admin-page-subtitle" style={{ marginBottom: 24 }}>View payment records linked to bookings.</p>

        <form onSubmit={(e) => { e.preventDefault(); setPage(1); load(search, 1); }} className="flex gap-2 mb-5">
          <div className="admin-toolbar-search" style={{ position: 'relative' }}>
            <Search size={14} className="search-icon" />
            <input 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
              onFocus={() => setSearchFocus(true)}
              onBlur={() => setSearchFocus(false)}
              placeholder="Search by transaction ID…" 
            />
            {searchFocus && searchSuggestions.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000, background: '#fff', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 8, maxHeight: 180, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', marginTop: 4 }}>
                {searchSuggestions.map((sug, idx) => (
                  <div
                    key={idx}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setSearch(sug.value);
                      setPage(1);
                      load(sug.value, 1);
                      setSearchFocus(false);
                    }}
                    style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: idx < searchSuggestions.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(112,93,0,0.06)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <span style={{ fontWeight: 600, color: '#1a1c1d', fontSize: 13 }}>{sug.value}</span>
                    <span style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>{sug.category}</span>
                  </div>
                ))}
              </div>
            )}
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
          pageSize={ADMIN_PAGE_SIZE}
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
