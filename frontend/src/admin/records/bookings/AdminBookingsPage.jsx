import { useEffect, useState } from 'react';
import { fetchWithAuth } from '@/services/apiClient';
import { Search, AlertCircle, X, Eye, Plane, User as UserIcon, CreditCard, Calendar, Ticket } from 'lucide-react';
import { Pagination } from '@/components/ui/Pagination';
import { Select } from '@/components/ui/Select';
import '@/admin/_core/styles/admin.css';

const STATUS_COLORS = {
  CONFIRMED: '#22c55e',
  PENDING_PAYMENT: '#f59e0b',
  CREATED: '#3b82f6',
  CANCELLED: '#ef4444',
  EXPIRED: '#6b7280',
  REFUNDED: '#8b5cf6',
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

  useEffect(() => {
    load(search, statusFilter, page);
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    load(search, statusFilter, 1);
  };

  const STATUS_OPTIONS = ['', 'CONFIRMED', 'CANCELLED', 'EXPIRED', 'REFUNDED'];
  const totalPages = Math.ceil(count / PAGE_SIZE) || 1;

  return (
    <div className="admin-page">
      <div className="admin-container">
        <h1 className="admin-page-title mb-2">Bookings Management</h1>
        <p className="admin-page-subtitle mb-6">
          Search by PNR or filter by booking status to view passenger details and itineraries.
        </p>

        <form onSubmit={handleSearch} className="flex gap-3 mb-5 flex-wrap items-center">
          <div className="admin-toolbar-search">
            <Search size={14} className="search-icon" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by PNR..." />
          </div>
          <div className="min-w-[180px]">
            <Select
              id="status-filter"
              options={STATUS_OPTIONS.map((s) => ({ value: s, label: s || 'All Statuses' }))}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            />
          </div>
          <button type="submit" className="btn-primary">
            Search
          </button>
        </form>

        {error && (
          <div className="admin-error">
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
        )}

        <div className="admin-card admin-table-wrap">
          {loading ? (
            <div className="admin-spinner-wrap">
              <div className="admin-spinner" />
            </div>
          ) : bookings.length === 0 ? (
            <div className="admin-empty">
              <p>No bookings found.</p>
            </div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>PNR</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th>Total Paid</th>
                  <th>Booking Date</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => {
                  const displayUser = b.user_full_name && b.user_full_name !== b.user
                    ? `${b.user_full_name} (@${b.user})`
                    : `@${b.user || b.user_id || 'guest'}`;

                  return (
                    <tr key={b.id} className="cursor-pointer hover:bg-black/5" onClick={() => setSelected(b)}>
                      <td>
                        <strong className="font-mono text-admin-primary">{b.pnr || b.id?.slice?.(0, 8)}</strong>
                      </td>
                      <td>
                        <div className="font-semibold text-[#1a1c1d]">{b.user_full_name || b.user || '—'}</div>
                        <div className="text-[11px] text-[#666]">{b.user_email || `@${b.user}`}</div>
                      </td>
                      <td>
                        <span
                          className="text-[11px] font-bold px-[10px] py-[3px] rounded-full border"
                          style={{
                            background: (STATUS_COLORS[b.status] || '#888') + '1b',
                            color: STATUS_COLORS[b.status] || '#888',
                            borderColor: (STATUS_COLORS[b.status] || '#888') + '35',
                          }}
                        >
                          {b.status || b.booking_status}
                        </span>
                      </td>
                      <td className="font-bold">₹{b.total_price_paid ?? b.total_price ?? '0.00'}</td>
                      <td className="text-[#555]">
                        {b.created_at ? new Date(b.created_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelected(b);
                          }}
                          className="btn-secondary px-3 py-[5px] text-xs inline-flex items-center gap-1"
                        >
                          <Eye size={13} /> View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalCount={count}
          pageSize={PAGE_SIZE}
          onPageChange={(p) => {
            setPage(p);
            load(search, statusFilter, p);
          }}
          entityLabel="bookings"
        />

        {/* Rich Booking Detail Modal */}
        {selected && (
          <div
            className="fixed inset-0 z-[9999] bg-black/45 backdrop-blur-[4px] flex items-center justify-center p-4"
            onClick={() => setSelected(null)}
          >
            <div
              className="bg-white rounded-[20px] max-w-[680px] w-full max-h-[90vh] overflow-y-auto shadow-[0_20px_50px_rgba(0,0,0,0.2)] p-6 relative"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex justify-between items-center mb-5 border-b border-[#eee] pb-4">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-xl font-extrabold text-[#1a1c1d] m-0">
                      Booking Detail #{selected.pnr || selected.id?.slice(0, 8)}
                    </h2>
                    <span
                      className="text-[11px] font-bold px-[10px] py-[3px] rounded-full border"
                      style={{
                        background: (STATUS_COLORS[selected.status] || '#888') + '1b',
                        color: STATUS_COLORS[selected.status] || '#888',
                        borderColor: (STATUS_COLORS[selected.status] || '#888') + '35',
                      }}
                    >
                      {selected.status}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="bg-[#f3f4f6] border-none rounded-full w-8 h-8 flex items-center justify-center cursor-pointer text-[#555]"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Customer & Booking Grid */}
              <div className="grid grid-cols-2 gap-4 mb-5">
                <div className="bg-[#f9f9fb] p-[14px] rounded-xl border border-[#eee]">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#705d00] mb-1.5">
                    <UserIcon size={14} /> Customer Information
                  </div>
                  <div className="text-sm font-bold text-[#111]">
                    {selected.user_full_name || selected.user || 'N/A'}
                  </div>
                  <div className="text-xs text-[#555] mt-0.5">
                    Username: <strong>@{selected.user}</strong>
                  </div>
                  {selected.user_email && (
                    <div className="text-xs text-[#555] mt-0.5">
                      Email: {selected.user_email}
                    </div>
                  )}
                </div>

                <div className="bg-[#f9f9fb] p-[14px] rounded-xl border border-[#eee]">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#705d00] mb-1.5">
                    <CreditCard size={14} /> Payment &amp; Ticket Info
                  </div>
                  <div className="text-sm font-bold text-[#111]">
                    Total Paid: ₹{selected.total_price ?? selected.total_price_paid ?? '0.00'}
                  </div>
                  <div className="text-xs text-[#555] mt-0.5">
                    Class: <strong>{selected.cabin_class || 'ECONOMY'}</strong> | Seats: <strong>{selected.seat_count || 1}</strong>
                  </div>
                  <div className="text-xs text-[#555] mt-0.5">
                    Booked On: {selected.created_at ? new Date(selected.created_at).toLocaleString() : '—'}
                  </div>
                </div>
              </div>

              {/* Flight Itinerary */}
              {selected.flight_detail && (
                <div className="bg-[#faf9f6] p-4 rounded-[14px] border border-[#eab30830] mb-5">
                  <div className="flex items-center gap-1.5 text-[13px] font-bold text-[#705d00] mb-2.5">
                    <Plane size={15} /> Flight Itinerary
                  </div>
                  <div className="flex justify-between items-center flex-wrap gap-3">
                    <div>
                      <div className="text-base font-extrabold text-[#1a1c1d]">
                        {selected.flight_detail.airline} ({selected.flight_detail.flight_number})
                      </div>
                      <div className="text-[13px] text-[#444] mt-0.5">
                        Route: <strong>{selected.flight_detail.source_airport} → {selected.flight_detail.destination_airport}</strong>
                      </div>
                    </div>
                    <div className="text-right text-xs text-[#555]">
                      <div>Departure: {selected.flight_detail.scheduled_departure ? new Date(selected.flight_detail.scheduled_departure).toLocaleString() : '—'}</div>
                      <div>Arrival: {selected.flight_detail.scheduled_arrival ? new Date(selected.flight_detail.scheduled_arrival).toLocaleString() : '—'}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Passengers Table */}
              <div>
                <h4 className="text-sm font-bold text-[#1a1c1d] mb-2.5 flex items-center gap-1.5">
                  <Ticket size={14} color="#705d00" /> Passenger Details ({selected.passengers?.length || 0})
                </h4>
                {selected.passengers && selected.passengers.length > 0 ? (
                  <table className="w-full border-collapse text-[13px]">
                    <thead>
                      <tr className="bg-[#f4f4f5] border-b-[1.5px] border-[#e4e4e7] uppercase text-[11px] text-[#666] text-left">
                        <th className="py-2 px-3">Name</th>
                        <th className="py-2 px-3">Age</th>
                        <th className="py-2 px-3">Gender</th>
                        <th className="py-2 px-3">Phone</th>
                        <th className="py-2 px-3">Seat</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.passengers.map((p, idx) => (
                        <tr key={p.id || idx} className="border-b border-[#eee]">
                          <td className="py-2 px-3 font-semibold">{p.name || p.full_name}</td>
                          <td className="py-2 px-3">{p.age}</td>
                          <td className="py-2 px-3">{p.gender}</td>
                          <td className="py-2 px-3">{p.phone_number || '—'}</td>
                          <td className="py-2 px-3">
                            <span className="font-bold bg-[#fef08a] text-[#713f12] px-2 py-0.5 rounded-md text-[11px]">
                              {p.seat_number || 'Auto-Assigned'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-xs text-[#888] italic">No detailed passenger record available.</p>
                )}
              </div>

              {/* Close Button */}
              <div className="mt-6 text-right">
                <button
                  onClick={() => setSelected(null)}
                  className="btn-secondary px-5 py-2 rounded-[10px]"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
