import { useEffect, useState, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { fetchFlightInstances, updateFlightInstance } from '@/admin/_core/store/adminSlices';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import DatePicker from '@/components/ui/DatePicker';
import { Edit2, Eye, Plane, RefreshCw, AlertCircle, Search, X, SlidersHorizontal, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';
import { Pagination } from '@/components/ui/Pagination';
import { useTranslation } from 'react-i18next';

import '@/admin/_core/styles/admin.css';
import { INR } from '@/utils/formatters';
const fmtDT = (iso) => new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });

const STATUS_STYLE = {
    SCHEDULED: { bg: '#d1fae5', color: '#065f46', border: '#6ee7b7' },
    DELAYED: { bg: '#fef3c7', color: '#92400e', border: '#fcd34d' },
    CANCELLED: { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' },
    BOARDING: { bg: '#dbeafe', color: '#1e40af', border: '#93c5fd' },
    DEPARTED: { bg: '#ede9fe', color: '#5b21b6', border: '#c4b5fd' },
    ARRIVED: { bg: '#f3e8ff', color: '#7c3aed', border: '#d8b4fe' },
};

const getStatusOptions = (t) => [
    { value: '', label: t("flights.allStatuses", { defaultValue: 'All Statuses' }) },
    { value: 'SCHEDULED', label: 'Scheduled' },
    { value: 'DELAYED', label: 'Delayed' },
    { value: 'CANCELLED', label: 'Cancelled' },
    { value: 'BOARDING', label: 'Boarding' },
    { value: 'DEPARTED', label: 'Departed' },
    { value: 'ARRIVED', label: 'Arrived' },
];

function Badge({ status }) {
    const s = STATUS_STYLE[status] || { bg: '#f3f4f6', color: '#374151', border: '#d1d5db' };
    return (
        <span style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}`, borderRadius: 9999, padding: '3px 10px', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            {status}
        </span>
    );
}

export default function FlightOverviewPage() {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const navigate = useNavigate();
    
    // Using flightInstance slice for live data
    const { items: flights, count, loading, actionLoading, error } = useSelector(s => s.flightInstance);
    
    const [currentPage, setCurrentPage] = useState(1);
    const PAGE_SIZE = 10;
    const totalPages = Math.ceil((count || 0) / PAGE_SIZE);
    
    const [editTarget, setEditTarget] = useState(null);
    const [editStatus, setEditStatus] = useState('');
    const [editDelay, setEditDelay] = useState(0);
    const [confirmOpen, setConfirmOpen] = useState(false);

    // Active filter/sort state
    const [activeSearch, setActiveSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [dateFilter, setDateFilter] = useState('');
    const [arrivalDateFilter, setArrivalDateFilter] = useState('');
    const [sourceFilter, setSourceFilter] = useState('');
    const [destFilter, setDestFilter] = useState('');
    const [sortBy, setSortBy] = useState('scheduled_departure');
    const [sortOrder, setSortOrder] = useState('desc');

    // Input state for inline quick search
    const [searchInput, setSearchInput] = useState('');

    // Modal open/close states
    const [filterOpen, setFilterOpen] = useState(false);

    // Draft states for advanced filters modal
    const [draftSearch, setDraftSearch] = useState('');
    const [draftStatus, setDraftStatus] = useState('');
    const [draftDate, setDraftDate] = useState('');
    const [draftArrivalDate, setDraftArrivalDate] = useState('');
    const [draftSource, setDraftSource] = useState('');
    const [draftDest, setDraftDest] = useState('');
    const [draftSortBy, setDraftSortBy] = useState('scheduled_departure');
    const [draftSortOrder, setDraftSortOrder] = useState('desc');

    const buildParams = useCallback((search, status, date, arrivalDate, source, dest, sortingBy, sortingOrder) => {
        const p = {};
        if (search) p.search = search;
        if (status) p.status = status;
        if (date) p.date = date;
        if (arrivalDate) p.arrival_date = arrivalDate;
        if (source) p.source = source;
        if (dest) p.destination = dest;

        // Sort direction prefix logic
        const orderingPrefix = sortingOrder === 'desc' ? '-' : '';
        p.ordering = `${orderingPrefix}${sortingBy}`;

        return p;
    }, []);

    const fetchFiltered = (page = 1, params) => {
        dispatch(fetchFlightInstances({ page, page_size: PAGE_SIZE, ...params }));
    };

    // Initial load
    useEffect(() => {
        fetchFiltered(currentPage, buildParams(activeSearch, statusFilter, dateFilter, arrivalDateFilter, sourceFilter, destFilter, sortBy, sortOrder));
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Quick search input change handler (only updates local state, fetching happens on submit/clear)
    const handleSearchChange = (e) => {
        setSearchInput(e.target.value);
    };

    const handleOpenFilters = () => {
        setDraftSearch(activeSearch);
        setDraftStatus(statusFilter);
        setDraftDate(dateFilter);
        setDraftArrivalDate(arrivalDateFilter);
        setDraftSource(sourceFilter);
        setDraftDest(destFilter);
        setDraftSortBy(sortBy);
        setDraftSortOrder(sortOrder);
        setFilterOpen(true);
    };

    const handleApplyFilters = () => {
        setActiveSearch(draftSearch);
        setSearchInput(draftSearch);
        setStatusFilter(draftStatus);
        setDateFilter(draftDate);
        setArrivalDateFilter(draftArrivalDate);
        setSourceFilter(draftSource);
        setDestFilter(draftDest);
        setSortBy(draftSortBy);
        setSortOrder(draftSortOrder);

        setCurrentPage(1);
        fetchFiltered(1, buildParams(draftSearch, draftStatus, draftDate, draftArrivalDate, draftSource, draftDest, draftSortBy, draftSortOrder));
        setFilterOpen(false);
    };

    const handleClearFilters = () => {
        setSearchInput('');
        setActiveSearch('');
        setStatusFilter('');
        setDateFilter('');
        setArrivalDateFilter('');
        setSourceFilter('');
        setDestFilter('');
        setSortBy('scheduled_departure');
        setSortOrder('desc');

        // Also reset drafts
        setDraftSearch('');
        setDraftStatus('');
        setDraftDate('');
        setDraftArrivalDate('');
        setDraftSource('');
        setDraftDest('');
        setDraftSortBy('scheduled_departure');
        setDraftSortOrder('desc');

        setCurrentPage(1);
        fetchFiltered(1, buildParams('', '', '', '', '', '', 'scheduled_departure', 'desc'));
        setFilterOpen(false);
    };

    const handleRemoveFilter = (filterKey) => {
        let nextSearch = activeSearch;
        let nextStatus = statusFilter;
        let nextDate = dateFilter;
        let nextArrivalDate = arrivalDateFilter;
        let nextSource = sourceFilter;
        let nextDest = destFilter;
        let nextSortBy = sortBy;
        let nextSortOrder = sortOrder;

        if (filterKey === 'search') {
            nextSearch = '';
            setSearchInput('');
            setActiveSearch('');
        } else if (filterKey === 'status') {
            nextStatus = '';
            setStatusFilter('');
        } else if (filterKey === 'date') {
            nextDate = '';
            setDateFilter('');
        } else if (filterKey === 'arrivalDate') {
            nextArrivalDate = '';
            setArrivalDateFilter('');
        } else if (filterKey === 'source') {
            nextSource = '';
            setSourceFilter('');
        } else if (filterKey === 'dest') {
            nextDest = '';
            setDestFilter('');
        } else if (filterKey === 'sort') {
            nextSortBy = 'scheduled_departure';
            nextSortOrder = 'desc';
            setSortBy('scheduled_departure');
            setSortOrder('desc');
        }

        setCurrentPage(1);
        fetchFiltered(1, buildParams(nextSearch, nextStatus, nextDate, nextArrivalDate, nextSource, nextDest, nextSortBy, nextSortOrder));
    };

    const hasActiveFilters = !!(
        activeSearch ||
        statusFilter ||
        dateFilter ||
        arrivalDateFilter ||
        sourceFilter ||
        destFilter ||
        sortBy !== 'scheduled_departure' ||
        sortOrder !== 'desc'
    );

    const handlePageChange = (page) => {
        setCurrentPage(page);
        fetchFiltered(page, buildParams(activeSearch, statusFilter, dateFilter, arrivalDateFilter, sourceFilter, destFilter, sortBy, sortOrder));
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    
    const handleStatusUpdate = async () => {
        if (!editTarget || !editStatus) return;
        setConfirmOpen(false);
        try {
            await dispatch(updateFlightInstance({ 
                id: editTarget.id, 
                data: { status: editStatus, delay_minutes: Number(editDelay) || 0 } 
            })).unwrap();
            
            const delayMsg = editDelay > 0 ? ` — delayed by ${editDelay} min` : '';
            toast.success(`Flight status updated to ${editStatus}${delayMsg}`);
            setEditTarget(null);
            fetchFiltered(currentPage, buildParams(activeSearch, statusFilter, dateFilter, arrivalDateFilter, sourceFilter, destFilter, sortBy, sortOrder));
        } catch (err) {
            toast.error(err?.detail || 'Failed to update flight status');
        }
    };

    return (
        <>
            <div className="admin-page-wrap">

                {/* Header */}
                <div className="flex justify-between items-start flex-wrap gap-4 mb-8">
                    <div>
                        <h1 className="admin-page-title">{t("admin.overviewTitle", { defaultValue: 'Flight Overview' })}</h1>
                        <p className="admin-page-subtitle">{t("admin.overviewSubtitle", { defaultValue: 'Monitor live flight instances, update statuses and check schedules.' })}</p>
                    </div>
                </div>

                {/* Main Control & Search Bar */}
                <div className="glass-card" style={{ borderRadius: 16, padding: '14px 20px', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', overflow: 'visible' }}>
                    {/* Quick Search */}
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            setActiveSearch(searchInput);
                            setCurrentPage(1);
                            fetchFiltered(1, buildParams(searchInput, statusFilter, dateFilter, arrivalDateFilter, sourceFilter, destFilter, sortBy, sortOrder));
                        }}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '1 1 300px', maxWidth: 480 }}
                    >
                        <div className="admin-toolbar-search" style={{ flex: 1, width: 'auto' }}>
                            <Search size={14} className="search-icon" />
                            <input
                                className="filter-input"
                                type="text"
                                placeholder={t("admin.searchPlaceholder", { defaultValue: 'Search flight no., airline, airport...' })}
                                value={searchInput}
                                onChange={handleSearchChange}
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
                        </div>
                        <button
                            type="submit"
                            className="btn-primary"
                            style={{ padding: '7px 14px', fontSize: 13, flexShrink: 0 }}
                        >
                            {t("admin.search", { defaultValue: 'Search' })}
                        </button>
                    </form>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        {/* Filter & Sort Modal Button */}
                        <button
                            onClick={handleOpenFilters}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: 'rgba(255,255,255,0.7)', border: '1.5px solid rgba(0,0,0,0.08)', borderRadius: 12, fontSize: 14, fontWeight: 600, color: '#1a1c1d', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.9)'; e.currentTarget.style.borderColor = 'rgba(112,93,0,0.2)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.7)'; e.currentTarget.style.borderColor = 'rgba(0,0,0,0.08)'; }}
                        >
                            <SlidersHorizontal size={15} color="#705d00" />
                            <span>{t("admin.filtersAndSorting", { defaultValue: 'Filters & Sorting' })}</span>
                            {hasActiveFilters && (
                                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 18, height: 18, borderRadius: '50%', background: '#705d00', color: '#fff', fontSize: 10, fontWeight: 700, padding: '0 2px' }}>
                                    {
                                        (statusFilter ? 1 : 0) +
                                        (dateFilter ? 1 : 0) +
                                        (arrivalDateFilter ? 1 : 0) +
                                        (sourceFilter ? 1 : 0) +
                                        (destFilter ? 1 : 0) +
                                        (sortBy !== 'scheduled_departure' || sortOrder !== 'desc' ? 1 : 0)
                                    }
                                </span>
                            )}
                        </button>

                        {/* Clear All quick button */}
                        {hasActiveFilters && (
                            <button
                                onClick={handleClearFilters}
                                style={{ padding: '10px 16px', background: 'rgba(220,38,38,0.08)', border: '1.5px solid rgba(220,38,38,0.15)', borderRadius: 12, fontSize: 14, fontWeight: 600, color: '#dc2626', cursor: 'pointer', transition: 'background 0.2s' }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(220,38,38,0.12)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'rgba(220,38,38,0.08)'}
                            >
                                {t("admin.clearAll", { defaultValue: 'Clear All' })}
                            </button>
                        )}
                    </div>
                </div>

                {/* Active Filter Chips / Badges */}
                {hasActiveFilters && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20, alignItems: 'center' }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#5e5e5e', textTransform: 'uppercase', marginRight: 4 }}>{t("admin.activeFilters", { defaultValue: 'Active Filters:' })}</span>
                        {statusFilter && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'rgba(112,93,0,0.08)', border: '1px solid rgba(112,93,0,0.15)', borderRadius: 20, fontSize: 12, color: '#705d00', fontWeight: 600 }}>
                                <span>Status: {statusFilter}</span>
                                <X size={12} style={{ cursor: 'pointer' }} onClick={() => handleRemoveFilter('status')} />
                            </div>
                        )}
                        {dateFilter && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'rgba(112,93,0,0.08)', border: '1px solid rgba(112,93,0,0.15)', borderRadius: 20, fontSize: 12, color: '#705d00', fontWeight: 600 }}>
                                <span>Departure: {dateFilter}</span>
                                <X size={12} style={{ cursor: 'pointer' }} onClick={() => handleRemoveFilter('date')} />
                            </div>
                        )}
                        {arrivalDateFilter && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'rgba(112,93,0,0.08)', border: '1px solid rgba(112,93,0,0.15)', borderRadius: 20, fontSize: 12, color: '#705d00', fontWeight: 600 }}>
                                <span>Arrival: {arrivalDateFilter}</span>
                                <X size={12} style={{ cursor: 'pointer' }} onClick={() => handleRemoveFilter('arrivalDate')} />
                            </div>
                        )}
                        {sourceFilter && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'rgba(112,93,0,0.08)', border: '1px solid rgba(112,93,0,0.15)', borderRadius: 20, fontSize: 12, color: '#705d00', fontWeight: 600 }}>
                                <span>From: {sourceFilter.toUpperCase()}</span>
                                <X size={12} style={{ cursor: 'pointer' }} onClick={() => handleRemoveFilter('source')} />
                            </div>
                        )}
                        {destFilter && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'rgba(112,93,0,0.08)', border: '1px solid rgba(112,93,0,0.15)', borderRadius: 20, fontSize: 12, color: '#705d00', fontWeight: 600 }}>
                                <span>To: {destFilter.toUpperCase()}</span>
                                <X size={12} style={{ cursor: 'pointer' }} onClick={() => handleRemoveFilter('dest')} />
                            </div>
                        )}
                        {(sortBy !== 'scheduled_departure' || sortOrder !== 'desc') && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'rgba(112,93,0,0.08)', border: '1px solid rgba(112,93,0,0.15)', borderRadius: 20, fontSize: 12, color: '#705d00', fontWeight: 600 }}>
                                <span>Sort: {sortBy.replace('_', ' ')} ({sortOrder === 'asc' ? 'Asc' : 'Desc'})</span>
                                <X size={12} style={{ cursor: 'pointer' }} onClick={() => handleRemoveFilter('sort')} />
                            </div>
                        )}
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div className="admin-error">
                        <AlertCircle size={16} />{error}
                    </div>
                )}

                {/* Table */}
                <div className="glass-card" style={{ borderRadius: 20, overflow: 'hidden' }}>
                    {loading ? (
                        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(248,250,252,0.9)', backdropFilter: 'blur(10px)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                            <Plane size={48} color="#705d00" className="animate-bounce" />
                            <div style={{ marginTop: 24, fontSize: 16, fontWeight: 600, color: '#1a1c1d', fontFamily: "'Plus Jakarta Sans',Inter,sans-serif" }}>{t("admin.fetching", { defaultValue: 'Fetching flights...' })}</div>
                        </div>
                    ) : flights.length === 0 ? (
                        <div style={{ padding: '64px 24px', textAlign: 'center' }}>
                            <Plane size={44} color="#d0c6ab" style={{ margin: '0 auto 16px' }} />
                            <p style={{ fontWeight: 700, fontSize: 16, color: '#5e5e5e' }}>
                                {hasActiveFilters ? t("admin.noMatch", { defaultValue: 'No flights match your filters.' }) : t("admin.noFlights", { defaultValue: 'No flights registered yet.' })}
                            </p>
                        </div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                <thead>
                                    <tr style={{ background: 'rgba(255,255,255,0.5)', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                                        {[t("admin.table.flightNo", { defaultValue: 'Flight No.' }), t("admin.table.route", { defaultValue: 'Route' }), t("admin.table.times", { defaultValue: 'Times (Dep / Arr)' }), t("admin.table.gate", { defaultValue: 'Gate/Terminal' }), t("admin.table.status", { defaultValue: 'Status' }), t("admin.table.actions", { defaultValue: 'Actions' })].map(h => (
                                            <th key={h} style={{ padding: '14px 16px', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#5e5e5e', whiteSpace: 'nowrap' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {flights.map(f => (
                                        <tr key={f.id} className="admin-row" style={{ borderBottom: '1px solid rgba(0,0,0,0.05)', transition: 'background 0.2s' }}>
                                            <td style={{ padding: '16px', fontWeight: 800, fontSize: 14, color: '#1a1c1d', whiteSpace: 'nowrap' }}>{f.flight_number}</td>
                                            <td style={{ padding: '16px', fontWeight: 700, fontSize: 14, color: '#1a1c1d', whiteSpace: 'nowrap' }}>
                                                {f.route?.source?.iata_code}<span style={{ color: '#705d00', margin: '0 4px' }}>→</span>{f.route?.destination?.iata_code}
                                            </td>
                                            <td style={{ padding: '16px', fontSize: 12, color: '#5e5e5e', lineHeight: 1.7 }}>
                                                <div>Dep: {fmtDT(f.scheduled_departure)}</div>
                                                <div>Arr: {fmtDT(f.scheduled_arrival)}</div>
                                            </td>
                                            <td style={{ padding: '16px', fontSize: 13, color: '#5e5e5e', whiteSpace: 'nowrap' }}>
                                                <div>Gate: {f.boarding_gate || '-'}</div>
                                                <div>Term: {f.departure_terminal || '-'} / {f.arrival_terminal || '-'}</div>
                                            </td>
                                            <td style={{ padding: '16px' }}><Badge status={f.status} /></td>
                                            <td style={{ padding: '16px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                    <button className="act" onClick={() => { setEditTarget(f); setEditStatus(f.status); setEditDelay(f.delay_minutes || 0); }} title="Update Status" style={{ padding: 8, borderRadius: 8, color: '#5e5e5e', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'background 0.2s' }}><Edit2 size={16} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {!loading && flights.length > 0 && (
                        <div style={{ padding: '0 20px 20px' }}>
                            <Pagination currentPage={currentPage} totalPages={totalPages} totalCount={count} pageSize={PAGE_SIZE} onPageChange={handlePageChange} />
                        </div>
                    )}
                </div>

                {/* Advanced Filters & Sorting Modal */}
                <Modal isOpen={filterOpen} onClose={() => setFilterOpen(false)} title={t("admin.filtersAndSorting", { defaultValue: 'Filters & Sorting' })}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: '8px 4px', maxHeight: '70vh', overflowY: 'auto' }} className="sidebar-scroll">

                        {/* Sorting Section */}
                        <div>
                            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#5e5e5e', marginBottom: 8 }}>{t("admin.modals.sortBy", { defaultValue: 'Sort By' })}</label>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <Select
                                    options={[
                                        { value: 'scheduled_departure', label: 'Departure Time' },
                                        { value: 'scheduled_arrival', label: 'Arrival Time' },
                                        { value: 'flight__flight_number', label: 'Flight Number' },
                                        { value: 'status', label: 'Status' }
                                    ]}
                                    value={draftSortBy}
                                    onChange={(e) => setDraftSortBy(e.target.value)}
                                />
                                <Select
                                    options={[
                                        { value: 'asc', label: 'Ascending' },
                                        { value: 'desc', label: 'Descending' }
                                    ]}
                                    value={draftSortOrder}
                                    onChange={(e) => setDraftSortOrder(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Flight Search */}
                        <div>
                            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#5e5e5e', marginBottom: 6 }}>{t("admin.modals.searchQuery", { defaultValue: 'Search Query' })}</label>
                            <div className="admin-toolbar-search" style={{ width: '100%' }}>
                                <Search size={14} className="search-icon" />
                                <input
                                    className="filter-input"
                                    type="text"
                                    placeholder={t("admin.searchPlaceholder", { defaultValue: 'Search flight no., airline, airport...' })}
                                    value={draftSearch}
                                    onChange={(e) => setDraftSearch(e.target.value)}
                                />
                                {draftSearch && (
                                    <button
                                        type="button"
                                        className="clear-search-btn"
                                        onClick={() => setDraftSearch('')}
                                        title="Clear search"
                                    >
                                        <X size={13} />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Routing Section */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <div>
                                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#5e5e5e', marginBottom: 6 }}>{t("admin.modals.sourceAirport", { defaultValue: 'Source Airport (IATA)' })}</label>
                                <div style={{ position: 'relative' }}>
                                    <MapPin size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9e9488', pointerEvents: 'none' }} />
                                    <input
                                        className="filter-input"
                                        type="text"
                                        placeholder="e.g. BOM"
                                        maxLength={5}
                                        value={draftSource}
                                        onChange={(e) => setDraftSource(e.target.value)}
                                        style={{ width: '100%', padding: '9px 12px 9px 34px', background: 'rgba(255,255,255,0.65)', border: '1.5px solid rgba(0,0,0,0.1)', borderRadius: 10, fontSize: 14, color: '#1a1c1d', fontFamily: 'Inter,sans-serif', outline: 'none', transition: 'border-color 0.2s, box-shadow 0.2s', boxSizing: 'border-box' }}
                                    />
                                </div>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#5e5e5e', marginBottom: 6 }}>{t("admin.modals.destAirport", { defaultValue: 'Destination Airport (IATA)' })}</label>
                                <div style={{ position: 'relative' }}>
                                    <MapPin size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9e9488', pointerEvents: 'none' }} />
                                    <input
                                        className="filter-input"
                                        type="text"
                                        placeholder="e.g. DEL"
                                        maxLength={5}
                                        value={draftDest}
                                        onChange={(e) => setDraftDest(e.target.value)}
                                        style={{ width: '100%', padding: '9px 12px 9px 34px', background: 'rgba(255,255,255,0.65)', border: '1.5px solid rgba(0,0,0,0.1)', borderRadius: 10, fontSize: 14, color: '#1a1c1d', fontFamily: 'Inter,sans-serif', outline: 'none', transition: 'border-color 0.2s, box-shadow 0.2s', boxSizing: 'border-box' }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Status and Dates */}
                        <div>
                            <Select
                                label={t("admin.table.status", { defaultValue: 'Status' })}
                                options={getStatusOptions(t)}
                                value={draftStatus}
                                onChange={(e) => setDraftStatus(e.target.value)}
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <div>
                                <DatePicker
                                    label={t("admin.modals.departureDate", { defaultValue: 'Departure Date' })}
                                    placeholder={t("admin.modals.anyDate", { defaultValue: 'Any date' })}
                                    value={draftDate}
                                    onChange={(val) => setDraftDate(val)}
                                />
                            </div>
                            <div>
                                <DatePicker
                                    label={t("admin.modals.arrivalDate", { defaultValue: 'Arrival Date' })}
                                    placeholder={t("admin.modals.anyDate", { defaultValue: 'Any date' })}
                                    value={draftArrivalDate}
                                    onChange={(val) => setDraftArrivalDate(val)}
                                />
                            </div>
                        </div>

                        {/* Space to allow DatePicker calendar dropdowns to render without causing scroll cuts */}
                        <div style={{ height: 180 }} />

                        {/* Action buttons */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 12, borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: 16 }}>
                            <button
                                onClick={handleClearFilters}
                                style={{ padding: '10px 18px', background: 'rgba(0,0,0,0.05)', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#5e5e5e', cursor: 'pointer', transition: 'background 0.2s' }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.08)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0.05)'}
                            >
                                {t("admin.modals.resetAll", { defaultValue: 'Reset All' })}
                            </button>
                            <button
                                onClick={handleApplyFilters}
                                style={{ padding: '10px 22px', background: '#1a1c1d', color: '#ffd700', fontWeight: 700, fontSize: 13, borderRadius: 8, border: 'none', cursor: 'pointer', transition: 'background 0.2s' }}
                                onMouseEnter={e => e.currentTarget.style.background = '#2a2d2e'}
                                onMouseLeave={e => e.currentTarget.style.background = '#1a1c1d'}
                            >
                                {t("admin.modals.applyFilters", { defaultValue: 'Apply Filters' })}
                            </button>
                        </div>
                    </div>
                </Modal>

                {/* Edit Status Modal */}
                <Modal isOpen={!!editTarget && !confirmOpen} onClose={() => setEditTarget(null)} title="Update Flight Status">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: '4px 0' }}>

                        {/* Flight identifier banner */}
                        {editTarget && (
                            <div style={{ background: 'rgba(112,93,0,0.06)', border: '1px solid rgba(112,93,0,0.12)', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                                <span style={{ fontSize: 18, fontWeight: 900, color: '#1a1c1d', letterSpacing: '-0.02em' }}>{editTarget.flight_number}</span>
                                <span style={{ fontSize: 13, color: '#9e9488' }}>·</span>
                                <span style={{ fontSize: 13, color: '#5e5e5e', fontWeight: 500 }}>
                                    {editTarget.route?.source?.iata_code} → {editTarget.route?.destination?.iata_code}
                                </span>
                            </div>
                        )}

                        {/* Status + Delay side by side */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 14, alignItems: 'start' }}>
                            <Select
                                label="New Status"
                                options={getStatusOptions(t).filter(o => o.value !== '')}
                                value={editStatus}
                                onChange={(e) => {
                                    const nextStatus = e.target.value;
                                    setEditStatus(nextStatus);
                                    // Auto reset delay to 0 if they change status away from DELAYED
                                    if (nextStatus !== 'DELAYED') {
                                        setEditDelay(0);
                                    }
                                }}
                            />

                            {/* Delay stepper */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 140 }}>
                                <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#5e5e5e' }}>Delay (min)</label>
                                <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid rgba(0,0,0,0.15)', borderRadius: 9, overflow: 'hidden', background: '#fff', height: 38 }}>
                                    <button
                                        type="button"
                                        onClick={() => { const v = Math.max(0, editDelay - 5); setEditDelay(v); if (v === 0 && editStatus === 'DELAYED') setEditStatus('SCHEDULED'); }}
                                        style={{ width: 34, height: '100%', border: 'none', background: 'rgba(0,0,0,0.03)', borderRight: '1px solid rgba(0,0,0,0.09)', fontSize: 18, fontWeight: 700, cursor: 'pointer', color: '#5e5e5e', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                                    >−</button>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        value={editDelay}
                                        onChange={e => {
                                            const v = Math.max(0, parseInt(e.target.value.replace(/\D/g, '')) || 0);
                                            setEditDelay(v);
                                            if (v > 0) setEditStatus('DELAYED');
                                        }}
                                        style={{ flex: 1, minWidth: 0, width: '100%', border: 'none', outline: 'none', textAlign: 'center', fontSize: 15, fontWeight: 800, fontFamily: 'Inter, sans-serif', color: '#1a1c1d', background: 'transparent' }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => { const v = Math.min(999, editDelay + 5); setEditDelay(v); setEditStatus('DELAYED'); }}
                                        style={{ width: 34, height: '100%', border: 'none', background: 'rgba(0,0,0,0.03)', borderLeft: '1px solid rgba(0,0,0,0.09)', fontSize: 18, fontWeight: 700, cursor: 'pointer', color: '#5e5e5e', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                                    >+</button>
                                </div>
                                {editDelay > 0 ? (
                                    <span style={{ fontSize: 10, color: '#92400e', fontWeight: 600 }}>⚠ Auto-sets to Delayed</span>
                                ) : (
                                    <span style={{ fontSize: 10, color: '#9e9488' }}>0 = no delay</span>
                                )}
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 4, borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                            <button
                                onClick={() => setEditTarget(null)}
                                style={{ padding: '9px 18px', background: 'rgba(0,0,0,0.05)', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#5e5e5e', cursor: 'pointer' }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    if (editStatus === 'DELAYED' && Number(editDelay) <= 0) {
                                        toast.error("Please enter a delay greater than 0 minutes for Delayed status.");
                                        return;
                                    }
                                    if (editStatus !== 'DELAYED' && Number(editDelay) > 0) {
                                        toast.error("Delay minutes can only be set when flight status is Delayed.");
                                        return;
                                    }
                                    setConfirmOpen(true);
                                }}
                                disabled={actionLoading}
                                style={{ padding: '9px 22px', background: '#1a1c1d', color: '#ffd700', fontWeight: 700, fontSize: 13, borderRadius: 8, border: 'none', cursor: 'pointer', opacity: actionLoading ? 0.7 : 1 }}
                            >
                                Save
                            </button>
                        </div>
                    </div>

                </Modal>

                {/* Confirmation Modal */}
                <Modal isOpen={confirmOpen} onClose={() => setConfirmOpen(false)} title="Confirm Update">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: '12px 4px' }}>
                        <p style={{ fontSize: 14, color: '#1a1c1d', margin: 0, lineHeight: 1.7 }}>
                            You are about to update <strong>{editTarget?.flight_number}</strong>:
                        </p>
                        <div style={{ background: 'rgba(112,93,0,0.06)', borderRadius: 10, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <div style={{ fontSize: 13, display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#5e5e5e', fontWeight: 600 }}>Status</span>
                                <span style={{ fontWeight: 800, color: '#1a1c1d' }}>{editStatus}</span>
                            </div>
                            <div style={{ fontSize: 13, display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#5e5e5e', fontWeight: 600 }}>Delay</span>
                                <span style={{ fontWeight: 800, color: editDelay > 0 ? '#92400e' : '#1a1c1d' }}>
                                    {editDelay > 0 ? `${editDelay} minutes` : 'No delay'}
                                </span>
                            </div>
                        </div>
                        <p style={{ fontSize: 12, color: '#9e9488', margin: 0 }}>This will update the live flight record and notify affected passengers.</p>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                            <button
                                onClick={() => setConfirmOpen(false)}
                                style={{ padding: '10px 18px', background: 'rgba(0,0,0,0.05)', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#5e5e5e', cursor: 'pointer' }}
                            >
                                Go Back
                            </button>
                            <button
                                onClick={handleStatusUpdate}
                                disabled={actionLoading}
                                style={{ padding: '10px 22px', background: '#1a1c1d', color: '#ffd700', fontWeight: 700, fontSize: 13, borderRadius: 8, border: 'none', cursor: 'pointer', opacity: actionLoading ? 0.7 : 1 }}
                            >
                                {actionLoading ? 'Updating...' : 'Confirm Update'}
                            </button>
                        </div>
                    </div>
                </Modal>

            </div>
        </>
    );
}