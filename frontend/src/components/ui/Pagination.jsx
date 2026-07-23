/**
 * Pagination
 * A glassmorphism-styled page navigator matching the Passenger admin panel.
 *
 * Props:
 *   currentPage  – number (1-based)
 *   totalPages   – number
 *   totalCount   – number (total items)
 *   pageSize     – number (items per page, default 10)
 *   onPageChange – (page: number) => void
 */
export function Pagination({ currentPage, totalPages, totalCount, pageSize = 10, onPageChange }) {
  if (totalPages <= 1) return null;

  const from = (currentPage - 1) * pageSize + 1;
  const to = Math.min(currentPage * pageSize, totalCount);

  // Build visible page numbers with ellipsis
  const getPages = () => {
    const pages = [];
    const delta = 1; // pages on each side of current

    const left = Math.max(2, currentPage - delta);
    const right = Math.min(totalPages - 1, currentPage + delta);

    pages.push(1);
    if (left > 2) pages.push('...');
    for (let i = left; i <= right; i++) pages.push(i);
    if (right < totalPages - 1) pages.push('...');
    if (totalPages > 1) pages.push(totalPages);

    return pages;
  };

  const btnBase = {
    minWidth: 36,
    height: 36,
    borderRadius: '0.5rem',
    border: '1.5px solid rgba(0,0,0,0.08)',
    background: 'rgba(255,255,255,0.7)',
    color: '#374151',
    fontWeight: 600,
    fontSize: '0.875rem',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 10px',
    transition: 'background 0.15s, border-color 0.15s, transform 0.1s',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    userSelect: 'none',
  };

  const activeStyle = {
    ...btnBase,
    background: '#1a1c1d',
    color: '#ffd700',
    borderColor: '#1a1c1d',
    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
  };

  const disabledStyle = {
    ...btnBase,
    opacity: 0.35,
    cursor: 'not-allowed',
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: '0.75rem',
      padding: '1rem 0.25rem 0.25rem',
    }}>
      {/* Left — results summary */}
      <p style={{
        margin: 0,
        fontSize: '0.82rem',
        color: '#6b7280',
        fontWeight: 500,
      }}>
        Showing <strong style={{ color: '#1a1c1d' }}>{from}–{to}</strong> of{' '}
        <strong style={{ color: '#1a1c1d' }}>{totalCount}</strong> flights
      </p>

      {/* Right — page buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
        {/* Prev */}
        <button
          id="pagination-prev"
          style={currentPage === 1 ? disabledStyle : btnBase}
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
          onMouseEnter={(e) => { if (currentPage !== 1) { e.currentTarget.style.background = 'rgba(255,255,255,0.95)'; e.currentTarget.style.borderColor = 'rgba(0,0,0,0.18)'; } }}
          onMouseLeave={(e) => { if (currentPage !== 1) { e.currentTarget.style.background = 'rgba(255,255,255,0.7)'; e.currentTarget.style.borderColor = 'rgba(0,0,0,0.08)'; } }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        {/* Page numbers */}
        {getPages().map((pg, i) =>
          pg === '...' ? (
            <span key={`ellipsis-${i}`} style={{ padding: '0 4px', color: '#9ca3af', fontSize: '0.875rem', lineHeight: '36px' }}>…</span>
          ) : (
            <button
              key={pg}
              id={`pagination-page-${pg}`}
              style={pg === currentPage ? activeStyle : btnBase}
              onClick={() => pg !== currentPage && onPageChange(pg)}
              onMouseEnter={(e) => { if (pg !== currentPage) { e.currentTarget.style.background = 'rgba(255,255,255,0.95)'; e.currentTarget.style.borderColor = 'rgba(0,0,0,0.18)'; } }}
              onMouseLeave={(e) => { if (pg !== currentPage) { e.currentTarget.style.background = 'rgba(255,255,255,0.7)'; e.currentTarget.style.borderColor = 'rgba(0,0,0,0.08)'; } }}
            >
              {pg}
            </button>
          )
        )}

        {/* Next */}
        <button
          id="pagination-next"
          style={currentPage === totalPages ? disabledStyle : btnBase}
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          onMouseEnter={(e) => { if (currentPage !== totalPages) { e.currentTarget.style.background = 'rgba(255,255,255,0.95)'; e.currentTarget.style.borderColor = 'rgba(0,0,0,0.18)'; } }}
          onMouseLeave={(e) => { if (currentPage !== totalPages) { e.currentTarget.style.background = 'rgba(255,255,255,0.7)'; e.currentTarget.style.borderColor = 'rgba(0,0,0,0.08)'; } }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
