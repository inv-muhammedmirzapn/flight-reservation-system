/**
 * FarePriceLogsPage — Read-only audit log table displaying historical base fare price changes.
 */
import { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Pagination } from '@/components/ui/Pagination';
import '@/admin/_core/styles/admin.css';
import { fetchFarePriceLogs, ADMIN_PAGE_SIZE } from '@/admin/_core/store/adminSlices';
import { History, Search, ArrowRight, User, AlertCircle, Clock } from 'lucide-react';
import { SpinnerLoader } from '@/components/ui/Loaders';

export default function FarePriceLogsPage() {
  const dispatch = useDispatch();
  const { items: logs, loading, count, error } = useSelector((s) => s.farePriceLog);

  const [search, setSearch] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [page, setPage] = useState(1);

  const load = useCallback((s, p) => {
    dispatch(fetchFarePriceLogs({ search: s, page: p }));
  }, [dispatch]);

  useEffect(() => {
    load(activeSearch, page);
  }, [load, activeSearch, page]);

  const formatDate = (isoString) => {
    if (!isoString) return '—';
    const date = new Date(isoString);
    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const totalPages = count ? Math.ceil(count / ADMIN_PAGE_SIZE) : 1;

  return (
    <div className="admin-page">
      <div className="admin-container">
        <div className="flex justify-between items-center mb-7">
          <div>
            <h1 className="admin-page-title flex items-center gap-2">
              <History size={24} className="text-[#705d00]" /> Fare Price Audit Logs
            </h1>
            <p className="admin-page-subtitle">
              {count} recorded price adjustments for flight route fare templates
            </p>
          </div>
        </div>

        {/* Search */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setActiveSearch(search);
            setPage(1);
          }}
          className="flex gap-2 mb-5 max-w-md"
        >
          <div className="admin-toolbar-search flex-grow">
            <Search size={14} className="search-icon" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by route, user, or fare code..."
            />
          </div>
          <button type="submit" className="btn-primary">Search</button>
        </form>

        {error && (
          <div className="admin-error">
            <AlertCircle size={16} />
            <span>{typeof error === 'string' ? error : JSON.stringify(error)}</span>
          </div>
        )}

        {/* Table */}
        <div className="admin-card admin-table-wrap">
          {loading ? (
            <SpinnerLoader />
          ) : logs?.length === 0 ? (
            <div className="admin-empty">
              <div className="admin-empty-icon"><History size={28} /></div>
              <h3>No price changes logged</h3>
              <p>When route fare templates are repriced, audit history will appear here.</p>
            </div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Changed By</th>
                  <th>Flight Route</th>
                  <th>Fare Code</th>
                  <th>Cabin Class</th>
                  <th>Old Price</th>
                  <th>New Price</th>
                  <th>Price Difference</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const oldPrice = Number(log.old_base_price);
                  const newPrice = Number(log.new_base_price);
                  const diff = newPrice - oldPrice;
                  const isIncrease = diff > 0;

                  return (
                    <tr key={log.id} className="admin-row">
                      <td className="whitespace-nowrap text-xs font-semibold text-slate-600 flex items-center gap-1.5 pt-3.5">
                        <Clock size={13} className="text-slate-400" />
                        {formatDate(log.changed_at)}
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                          <User size={13} className="text-slate-400" />
                          <span>{log.changed_by_email || log.changed_by || 'System Admin'}</span>
                        </div>
                      </td>
                      <td>
                        <strong className="text-xs text-slate-800">
                          {log.flight_no || log.route_info || `Route #${log.route_fare_class}`}
                        </strong>
                      </td>
                      <td>
                        <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 border border-slate-200 font-semibold">
                          {log.fare_code || '—'}
                        </span>
                      </td>
                      <td>
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                          log.cabin_class === 'FIRST' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                          log.cabin_class === 'BUSINESS' ? 'bg-purple-100 text-purple-800 border border-purple-300' :
                          'bg-blue-100 text-blue-800 border border-blue-300'
                        }`}>
                          {log.cabin_class || 'ECONOMY'}
                        </span>
                      </td>
                      <td className="font-mono text-xs text-slate-500">
                        INR {oldPrice.toLocaleString('en-IN')}
                      </td>
                      <td className="font-mono text-xs font-bold text-slate-900">
                        INR {newPrice.toLocaleString('en-IN')}
                      </td>
                      <td>
                        <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-md ${
                          diff === 0 ? 'bg-slate-100 text-slate-600' :
                          isIncrease ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                          'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}>
                          {isIncrease ? `+INR ${diff.toLocaleString('en-IN')}` : diff < 0 ? `-INR ${Math.abs(diff).toLocaleString('en-IN')}` : 'No Change'}
                        </span>
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
          totalCount={count || logs?.length || 0}
          pageSize={ADMIN_PAGE_SIZE}
          onPageChange={(p) => setPage(p)}
          entityLabel="logs"
        />
      </div>
    </div>
  );
}
