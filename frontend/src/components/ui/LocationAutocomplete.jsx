import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { fetchWithAuth, API_BASE_URL } from '@/services/apiClient';

export default function LocationAutocomplete({ 
  value, 
  onChange, 
  placeholder, 
  className,
  style,
  autoComplete = 'off',
  onSelect
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  const containerRef = useRef(null);
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      const isOutsideContainer = containerRef.current && !containerRef.current.contains(e.target);
      const isOutsideDropdown = dropdownRef.current && !dropdownRef.current.contains(e.target);
      if (isOutsideContainer && isOutsideDropdown) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const updateCoords = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setCoords({ top: rect.bottom + window.scrollY, left: rect.left + window.scrollX, width: rect.width });
    }
  };

  useEffect(() => {
    if (open) {
      updateCoords();
      window.addEventListener('scroll', updateCoords, true);
      window.addEventListener('resize', updateCoords);
      return () => {
        window.removeEventListener('scroll', updateCoords, true);
        window.removeEventListener('resize', updateCoords);
      };
    }
  }, [open]);

  // Auto focus search input when opened
  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const fetchOptions = async (searchQuery = '') => {
    setLoading(true);
    try {
      const endpoint = searchQuery
        ? `/flights/master/airports/?q=${encodeURIComponent(searchQuery)}`
        : `/flights/master/airports/`;
      const data = await fetchWithAuth(endpoint);
      setOptions(data?.results || data || []);
    } catch (err) {
      console.error('Error fetching airports:', err);
      setOptions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = () => {
    if (!open) {
      updateCoords();
      setOpen(true);
      setQuery(''); // reset search when reopening
      if (options.length === 0) fetchOptions('');
    }
  };

  const handleSearchInput = (e) => {
    const val = e.target.value;
    setQuery(val);
    
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchOptions(val);
    }, 300);
  };

  const handleSelect = (airport) => {
    const displayVal = airport.iata_code; 
    onChange(displayVal);
    if (onSelect) onSelect(airport);
    setOpen(false);
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: style?.width || '100%', flex: style?.flex }}>
      {/* TRIGGER - Acts like the original input but opens dropdown */}
      <input
        type="text"
        readOnly
        value={value}
        onClick={handleOpen}
        placeholder={placeholder}
        className={className}
        style={{ ...style, cursor: 'pointer', flex: 'unset', width: '100%', background: 'transparent' }}
        autoComplete={autoComplete}
      />
      
      {open && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: 'absolute',
            top: coords.top + 8,
            left: coords.left,
            zIndex: 999999, // extremely high to escape all contexts
            background: '#fff',
            border: '1px solid rgba(0,0,0,0.08)',
            borderRadius: 16,
            boxShadow: '0 12px 48px rgba(0,0,0,0.12)',
            width: Math.max(340, coords.width),
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* POPUP SEARCH INPUT */}
          <div style={{ padding: '16px', borderBottom: '1px solid rgba(0,0,0,0.06)', background: '#f8f9fa' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: '1.5px solid #705d00', 
              borderRadius: 10, padding: '10px 14px', boxShadow: '0 2px 10px rgba(112,93,0,0.08)'
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#705d00' }}>search</span>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={handleSearchInput}
                placeholder="Search airports or cities..."
                style={{
                  border: 'none', outline: 'none', background: 'transparent', flex: 1, fontSize: 14, color: '#1a1c1d', fontWeight: 600, fontFamily: 'Inter, sans-serif'
                }}
              />
            </div>
          </div>

          {/* LIST */}
          <ul style={{
            margin: 0,
            padding: '8px',
            listStyle: 'none',
            maxHeight: 320,
            overflowY: 'auto',
          }}>
            {loading && options.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#5e5e5e', fontSize: 13, fontWeight: 600 }}>Loading airports...</div>
            ) : options.length > 0 ? (
              options.map((opt) => (
                <li
                  key={opt.id}
                  onMouseDown={(e) => { e.preventDefault(); handleSelect(opt); }}
                  style={{
                    padding: '12px 16px',
                    borderRadius: 10,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 14,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.03)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <span className="material-symbols-outlined" style={{ color: '#9ca3af', fontSize: 22, marginTop: 2 }}>location_on</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 15, fontWeight: 800, color: '#1a1c1d' }}>{opt.iata_code}</span>
                      <span style={{ fontSize: 14, fontWeight: 600, color: '#4b5563' }}>{opt.city}</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4, fontWeight: 500, lineHeight: 1.4 }}>
                      {opt.airport_name}
                    </div>
                  </div>
                </li>
              ))
            ) : (
              <div style={{ padding: '24px', textAlign: 'center', color: '#5e5e5e', fontSize: 13, fontWeight: 600 }}>No airports found for "{query}".</div>
            )}
          </ul>
        </div>,
        document.body
      )}
    </div>
  );
}
