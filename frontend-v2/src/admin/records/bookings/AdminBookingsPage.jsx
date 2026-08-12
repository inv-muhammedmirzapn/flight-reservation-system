import { useEffect, useState, useCallback } from 'react';
import { fetchWithAuth } from '@/services/apiClient';
import { Search, AlertCircle, X, Eye, Plane, User as UserIcon, CreditCard, Ticket } from 'lucide-react';
import { Pagination } from '@/components/ui/Pagination';
import { Select } from '@/components/ui/Select';
import '@/admin/_core/styles/admin.css';
import { parseApiError } from '@/utils/errorUtils';
import toast from 'react-hot-toast';
import DeleteConfirmationModal from '../../_core/DeleteConfirmationModal';

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
  const [cancelling, setCancelling] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const PAGE_SIZE = 10;

  const executeCancelBooking = async () => {
    if (!selected) return;
    setCancelling(true);
    try {
      await fetchWithAuth(`/bookings/admin/bookings/${selected.id}/force-cancel/`, { method: 'POST' });
      toast.success("Booking force-cancelled successfully.");
      setCancelModalOpen(false);
      setSelected(null);
      load(search, statusFilter, page);
    } catch (err) {
      toast.error(parseApiError(err, 'Failed to cancel booking.'));
    } finally {
      setCancelling(false);
    }
  };

  const load = useCallback(async (s, st, p) => {
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
      setError(parseApiError(err, 'Failed to load bookings.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load('', '', 1);
  }, [load]);

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
        <h1 className="admin-page-title" style={{ marginBottom: 8 }}>Bookings Management</h1>
        <p className="admin-page-subtitle" style={{ marginBottom: 24 }}>
          Search by PNR or filter by booking status to view passenger details and itineraries.
        </p>

        <form onSubmit={handleSearch} className="flex gap-3 mb-5 flex-wrap items-center">
          <div className="admin-toolbar-search">
            <Search size={14} className="search-icon" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by PNR..." />
          </div>
          <div style={{ minWidth: 180 }}>
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
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => {
                  // eslint-disable-next-line unused-imports/no-unused-vars
                  const displayUser = b.user_full_name && b.user_full_name !== b.user
                    ? `${b.user_full_name} (@${b.user})`
                    : `@${b.user || b.user_id || 'guest'}`;

                  return (
                    <tr key={b.id} className="cursor-pointer hover:bg-black/5" onClick={() => setSelected(b)}>
                      <td>
                        <strong className="font-mono text-admin-primary">{b.pnr || b.id?.slice?.(0, 8)}</strong>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: '#1a1c1d' }}>{b.user_full_name || b.user || '—'}</div>
                        <div style={{ fontSize: 11, color: '#666' }}>{b.user_email || `@${b.user}`}</div>
                      </td>
                      <td>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '3px 10px',
                            borderRadius: 20,
                            background: (STATUS_COLORS[b.status] || '#888') + '1b',
                            color: STATUS_COLORS[b.status] || '#888',
                            border: `1px solid ${(STATUS_COLORS[b.status] || '#888')}35`,
                          }}
                        >
                          {b.status || b.booking_status}
                        </span>
                      </td>
                      <td style={{ fontWeight: 700 }}>₹{b.total_price_paid ?? b.total_price ?? '0.00'}</td>
                      <td style={{ color: '#555' }}>
                        {b.created_at ? new Date(b.created_at).toLocaleDateString() : '—'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelected(b);
                          }}
                          className="btn-secondary"
                          style={{ padding: '5px 12px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 5 }}
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
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9990,
              background: 'rgba(0,0,0,0.45)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
            }}
            onClick={() => setSelected(null)}
          >
            <div
              style={{
                background: '#ffffff',
                borderRadius: 20,
                maxWidth: 680,
                width: '100%',
                maxHeight: '90vh',
                overflowY: 'auto',
                boxShadow: '0 20px 50px rgba(0,0,0,0.2)',
                padding: 24,
                position: 'relative',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottom: '1px solid #eee', paddingBottom: 16 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1a1c1d', margin: 0 }}>
                      Booking Detail #{selected.pnr || selected.id?.slice(0, 8)}
                    </h2>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '3px 10px',
                        borderRadius: 20,
                        background: (STATUS_COLORS[selected.status] || '#888') + '1b',
                        color: STATUS_COLORS[selected.status] || '#888',
                        border: `1px solid ${(STATUS_COLORS[selected.status] || '#888')}35`,
                      }}
                    >
                      {selected.status}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  style={{
                    background: '#f3f4f6',
                    border: 'none',
                    borderRadius: '50%',
                    width: 32,
                    height: 32,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: '#555',
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Customer & Booking Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                <div style={{ background: '#f9f9fb', padding: 14, borderRadius: 12, border: '1px solid #eee' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#705d00', marginBottom: 6 }}>
                    <UserIcon size={14} /> Customer Information
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>
                    {selected.user_full_name || selected.user || 'N/A'}
                  </div>
                  <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>
                    Username: <strong>@{selected.user}</strong>
                  </div>
                  {selected.user_email && (
                    <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>
                      Email: {selected.user_email}
                    </div>
                  )}
                </div>

                <div style={{ background: '#f9f9fb', padding: 14, borderRadius: 12, border: '1px solid #eee' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#705d00', marginBottom: 6 }}>
                    <CreditCard size={14} /> Payment & Ticket Info
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>
                    Total Paid: ₹{selected.total_price ?? selected.total_price_paid ?? '0.00'}
                  </div>
                  <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>
                    Class: <strong>{selected.cabin_class || 'ECONOMY'}</strong> | Seats: <strong>{selected.seat_count || 1}</strong>
                  </div>
                  <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>
                    Booked On: {selected.created_at ? new Date(selected.created_at).toLocaleString() : '—'}
                  </div>
                </div>
              </div>

              {/* Flight Itinerary */}
              {selected.flight_detail && (
                <div style={{ background: '#faf9f6', padding: 16, borderRadius: 14, border: '1px solid #eab30830', marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#705d00', marginBottom: 10 }}>
                    <Plane size={15} /> Flight Itinerary
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: '#1a1c1d' }}>
                        {selected.flight_detail.airline} ({selected.flight_detail.flight_number})
                      </div>
                      <div style={{ fontSize: 13, color: '#444', marginTop: 2 }}>
                        Route: <strong>{selected.flight_detail.source_airport} → {selected.flight_detail.destination_airport}</strong>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: 12, color: '#555' }}>
                      <div>Departure: {selected.flight_detail.scheduled_departure ? new Date(selected.flight_detail.scheduled_departure).toLocaleString() : '—'}</div>
                      <div>Arrival: {selected.flight_detail.scheduled_arrival ? new Date(selected.flight_detail.scheduled_arrival).toLocaleString() : '—'}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Passengers Table */}
              <div>
                <h4 style={{ fontSize: 14, fontWeight: 700, color: '#1a1c1d', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Ticket size={14} color="#705d00" /> Passenger Details ({selected.passengers?.length || 0})
                </h4>
                {selected.passengers && selected.passengers.length > 0 ? (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: '#f4f4f5', borderBottom: '1.5px solid #e4e4e7', textTransform: 'uppercase', fontSize: 11, color: '#666', textAlign: 'left' }}>
                        <th style={{ padding: '8px 12px' }}>Name</th>
                        <th style={{ padding: '8px 12px' }}>Age</th>
                        <th style={{ padding: '8px 12px' }}>Gender</th>
                        <th style={{ padding: '8px 12px' }}>Phone</th>
                        <th style={{ padding: '8px 12px' }}>Seat</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.passengers.map((p, idx) => (
                        <tr key={p.id || idx} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: '8px 12px', fontWeight: 600 }}>{p.name || p.full_name}</td>
                          <td style={{ padding: '8px 12px' }}>{p.age}</td>
                          <td style={{ padding: '8px 12px' }}>{p.gender}</td>
                          <td style={{ padding: '8px 12px' }}>{p.phone_number || '—'}</td>
                          <td style={{ padding: '8px 12px' }}>
                            <span style={{ fontWeight: 700, background: '#fef08a', color: '#713f12', padding: '2px 8px', borderRadius: 6, fontSize: 11 }}>
                              {p.seat_number || 'Auto-Assigned'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p style={{ fontSize: 12, color: '#888', fontStyle: 'italic' }}>No detailed passenger record available.</p>
                )}
              </div>

              {/* Close & Actions Button */}
              <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                {selected.status !== 'CANCELLED' && selected.status !== 'EXPIRED' && selected.status !== 'REFUNDED' && (
                  <button
                    onClick={() => setCancelModalOpen(true)}
                    disabled={cancelling}
                    className="btn-danger"
                    style={{ padding: '8px 20px', borderRadius: 10 }}
                  >
                    {cancelling ? 'Cancelling...' : 'Force Cancel'}
                  </button>
                )}
                <button
                  onClick={() => setSelected(null)}
                  className="btn-secondary"
                  style={{ padding: '8px 20px', borderRadius: 10 }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        <DeleteConfirmationModal
          isOpen={cancelModalOpen}
          onClose={() => setCancelModalOpen(false)}
          onConfirm={executeCancelBooking}
          title="Force-Cancel Booking"
          message={`Are you sure you want to force-cancel booking ${selected?.pnr || selected?.id?.slice(0, 8)}? This action cannot be undone.`}
          confirmText="Force Cancel"
          loading={cancelling}
        />
      </div>
    </div>
  );
}
