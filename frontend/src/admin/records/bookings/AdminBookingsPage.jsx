/**
 * AdminBookingsPage — searchable by PNR, filterable by status, detail view.
 */
import { useEffect, useState } from 'react';
import { fetchWithAuth } from '@/services/apiClient';
import { Search, AlertCircle } from 'lucide-react';
import { Pagination } from '@/components/ui/Pagination';
import { Select } from '@/components/ui/Select';
import '@/admin/_core/styles/admin.css';

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
  const PAGE_SIZE = 10;

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
    <div className="admin-page">
      <div className="admin-container">
        <h1 className="admin-page-title" style={{ marginBottom: 8 }}>Bookings</h1>
        <p className="admin-page-subtitle" style={{ marginBottom: 24 }}>Search by PNR and filter by booking status.</p>

        <form onSubmit={handleSearch} className="flex gap-2 mb-5 flex-wrap items-center">
          <div className="admin-toolbar-search">
            <Search size={14} className="search-icon" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search PNR…" />
          </div>
          <div style={{ minWidth: 160 }}>
            <Select
              id="status-filter"
              options={STATUS_OPTIONS.map(s => ({ value: s, label: s || 'All statuses' }))}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            />
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
          ) : bookings.length === 0 ? (
            <div className="admin-empty"><p>No bookings found.</p></div>
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

        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalCount={count}
          pageSize={PAGE_SIZE}
          onPageChange={(p) => { setPage(p); load(search, statusFilter, p); }}
          entityLabel="bookings"
        />

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
    </div>
  );
}
