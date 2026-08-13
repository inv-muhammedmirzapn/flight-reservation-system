/**
 * AdminPassengersPage — list + detail, linked to booking.
 */
import { useEffect, useState } from 'react';
import { fetchWithAuth } from '@/services/apiClient';
import { Search, AlertCircle } from 'lucide-react';
import { Pagination } from '@/components/ui/Pagination';
import '@/admin/_core/styles/admin.css';

export default function AdminPassengersPage() {
  const [passengers, setPassengers] = useState([]);
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
      const data = await fetchWithAuth(`/bookings/passengers/?${params}`);
      setPassengers(data.results || data || []);
      setCount(data.count || (data?.length ?? 0));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load('', 1); }, []);

  const totalPages = Math.ceil(count / PAGE_SIZE) || 1;

  return (
    <div className="admin-page">
      <div className="admin-container">
        <h1 className="admin-page-title mb-2">Passengers</h1>
        <p className="admin-page-subtitle mb-6">View passenger records linked to bookings.</p>

        <form onSubmit={(e) => { e.preventDefault(); setPage(1); load(search, 1); }} className="flex gap-2 mb-5">
          <div className="admin-toolbar-search">
            <Search size={14} className="search-icon" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or passport…" />
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
          ) : passengers.length === 0 ? (
            <div className="admin-empty"><p>No passengers found.</p></div>
          ) : (
            <table className="admin-table">
              <thead><tr><th>Name</th><th>Gender</th><th>Category</th><th>Passport No</th><th>Wheelchair</th><th>Booking ID</th></tr></thead>
              <tbody>
                {passengers.map((p) => (
                  <tr key={p.id} onClick={() => setSelected(selected?.id === p.id ? null : p)}>
                    <td><strong>{p.full_name || p.name}</strong></td>
                    <td>{p.gender || '—'}</td>
                    <td>{p.category || '—'}</td>
                    <td><code className="text-xs">{p.passport_no || '—'}</code></td>
                    <td>{p.need_wheelchair ? '✓' : '—'}</td>
                    <td className="text-xs text-[#888]">{String(p.booking).slice(0, 8)}…</td>
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
          entityLabel="passengers"
        />

        {selected && (
          <div className="detail-card">
            <h3 className="text-base font-extrabold mb-4 text-[#1a1c1d]">Passenger Detail</h3>
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
