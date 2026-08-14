import re

with open("/home/muhammedmirzapn/flight-management/frontend-v2/src/admin/operations/flight-overview/FlightOverviewPage.jsx", "r") as f:
    content = f.read()

# 1. Add fetchAirlines to imports
content = content.replace(
    "import { fetchFlightInstances, updateFlightInstance, fetchAirports } from '@/admin/_core/store/adminSlices';",
    "import { fetchFlightInstances, updateFlightInstance, fetchAirports, fetchAirlines } from '@/admin/_core/store/adminSlices';"
)

# 2. Add airlines selector
content = content.replace(
    "const { items: airports = [] } = useSelector(s => s.airport || {});",
    "const { items: airports = [] } = useSelector(s => s.airport || {});\n    const { items: airlines = [] } = useSelector(s => s.airline || {});"
)

# 3. Add searchFocus state
content = content.replace(
    "const [searchInput, setSearchInput] = useState('');",
    "const [searchInput, setSearchInput] = useState('');\n    const [searchFocus, setSearchFocus] = useState(false);"
)

# 4. Fetch airlines
content = content.replace(
    "dispatch(fetchAirports({ page_size: 500 }));\n    }, [fetchFiltered, buildParams, dispatch]);",
    "dispatch(fetchAirports({ page_size: 500 }));\n        dispatch(fetchAirlines({ page_size: 500 }));\n    }, [fetchFiltered, buildParams, dispatch]);"
)

# 5. Add getSearchSuggestions function
suggestions_func = """
    const getSearchSuggestions = (query) => {
        if (!query || query.trim().length < 1) return [];
        const cleanQuery = query.toLowerCase().trim();
        const suggestions = [];

        // 1. Check Flights
        const matchedFlights = (flights || []).filter(f => 
            f.flight_number?.toLowerCase().includes(cleanQuery)
        ).slice(0, 2);
        
        const uniqueFlights = [];
        matchedFlights.forEach(f => {
             if(f.flight_number && !uniqueFlights.includes(f.flight_number)) uniqueFlights.push(f.flight_number);
        });
        uniqueFlights.forEach(fn => suggestions.push({ type: 'Flight No', label: fn, value: fn }));

        // 2. Check Airlines
        const matchedAirlines = (airlines || []).filter(a => 
            a.airline_name?.toLowerCase().includes(cleanQuery) ||
            a.iata_airline_code?.toLowerCase().includes(cleanQuery)
        ).slice(0, 2);
        
        matchedAirlines.forEach(a => suggestions.push({ type: 'Airline', label: a.airline_name, value: a.airline_name }));

        // 3. Check Airports
        const matchedAirports = (airports || []).filter(a => 
            a.iata_code?.toLowerCase().includes(cleanQuery) || 
            a.city?.toLowerCase().includes(cleanQuery) || 
            a.airport_name?.toLowerCase().includes(cleanQuery)
        ).slice(0, 3);
        
        matchedAirports.forEach(a => suggestions.push({ type: 'Airport', label: `${a.city} (${a.iata_code})`, value: a.iata_code }));

        return suggestions;
    };
"""
content = content.replace(
    "const getAirportSuggestions = (query) => {",
    suggestions_func + "\n    const getAirportSuggestions = (query) => {"
)

# 6. Update search input render
search_input = """<div className="admin-toolbar-search" style={{ position: 'relative' }}>
                            <Search size={14} className="search-icon" />
                            <input
                                className="filter-input"
                                type="text"
                                placeholder={t("admin.searchPlaceholder", { defaultValue: 'Search flight no., airline, airport...' })}
                                value={searchInput}
                                onChange={handleSearchChange}
                                onFocus={() => setSearchFocus(true)}
                                onBlur={() => setTimeout(() => setSearchFocus(false), 200)}
                            />
                            {searchInput && (
                                <button
                                    type="button"
                                    className="clear-search-btn"
                                    onClick={() => {
                                        setSearchInput('');
                                        setActiveSearch('');
                                        setCurrentPage(1);
                                        fetchFiltered(1, buildParams('', statusFilter, dateFilter, arrivalDateFilter, sourceFilter, destFilter, sortBy, sortOrder));
                                    }}
                                    title="Clear search"
                                >
                                    <X size={13} />
                                </button>
                            )}
                            
                            {/* Autocomplete Dropdown */}
                            {searchFocus && getSearchSuggestions(searchInput).length > 0 && (
                                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000, background: '#fff', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 8, maxHeight: 300, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', marginTop: 4 }}>
                                    {getSearchSuggestions(searchInput).map((sug, idx) => (
                                        <div
                                            key={idx}
                                            onMouseDown={() => {
                                                setSearchInput(sug.value);
                                                setActiveSearch(sug.value);
                                                setCurrentPage(1);
                                                fetchFiltered(1, buildParams(sug.value, statusFilter, dateFilter, arrivalDateFilter, sourceFilter, destFilter, sortBy, sortOrder));
                                                setSearchFocus(false);
                                            }}
                                            style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', gap: 2 }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(112,93,0,0.06)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                        >
                                            <span style={{ fontSize: 10, fontWeight: 700, color: '#9e9488', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{sug.type}</span>
                                            <span style={{ fontWeight: 600, color: '#1a1c1d', fontSize: 13 }}>{sug.label}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>"""

content = re.sub(r'<div className="admin-toolbar-search">.*?</div>', search_input, content, flags=re.DOTALL, count=1)


with open("/home/muhammedmirzapn/flight-management/frontend-v2/src/admin/operations/flight-overview/FlightOverviewPage.jsx", "w") as f:
    f.write(content)

print("FlightOverview patched!")
