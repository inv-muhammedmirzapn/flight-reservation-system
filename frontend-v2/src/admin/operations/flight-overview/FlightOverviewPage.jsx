import { useEffect, useState, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { fetchFlightInstances, updateFlightInstance, fetchAirports } from '@/admin/_core/store/adminSlices';
import { Select } from '@/components/ui/Select';
import DatePicker from '@/components/ui/DatePicker';
import { Edit2, Eye, Plane, RefreshCw, AlertCircle, Search, X, SlidersHorizontal, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';
import { parseApiError } from '@/utils/errorUtils';
import { Pagination } from '@/components/ui/Pagination';
import { useTranslation } from 'react-i18next';

import '@/admin/_core/styles/admin.css';
import { INR } from '@/utils/formatters';
import StatusBadge from '@/admin/_core/components/StatusBadge';
import PageLoader from '@/admin/_core/components/PageLoader';
const fmtDT = (iso) => new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });

const getStatusOptions = (t) => [
    { value: '', label: t("flights.allStatuses", { defaultValue: 'All Statuses' }) },
    { value: 'SCHEDULED', label: 'Scheduled' },
    { value: 'DELAYED', label: 'Delayed' },
    { value: 'CANCELLED', label: 'Cancelled' },
    { value: 'BOARDING', label: 'Boarding' },
    { value: 'DEPARTED', label: 'Departed' },
    { value: 'ARRIVED', label: 'Arrived' },
];

export default function FlightOverviewPage() {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const navigate = useNavigate();

    // Using flightInstance slice for live data
    const { items: flights, count, loading, actionLoading, error } = useSelector(s => s.flightInstance);
    const { items: airports = [] } = useSelector(s => s.airport || {});

    const [currentPage, setCurrentPage] = useState(1);
    const [sourceFocus, setSourceFocus] = useState(false);
    const [destFocus, setDestFocus] = useState(false);
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
        dispatch(fetchAirports({ page_size: 500 }));
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Lock background page scroll when any modal is open
    const anyModalOpen = filterOpen || (!!editTarget && !confirmOpen) || confirmOpen;
    useEffect(() => {
        if (anyModalOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [anyModalOpen]);

    // Quick search input change handler (only updates local state, fetching happens on submit/clear)
    const handleSearchChange = (e) => {
        setSearchInput(e.target.value);
    };

    const getAirportSuggestions = (query) => {
        if (!query || query.trim().length < 1) return [];
        const cleanQuery = query.toLowerCase().trim();
        return airports.filter(a => 
            a.iata_code?.toLowerCase().includes(cleanQuery) || 
            a.city?.toLowerCase().includes(cleanQuery) || 
            a.airport_name?.toLowerCase().includes(cleanQuery)
        ).slice(0, 5);
    };

    const handleOpenFilters = () => {
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
        setStatusFilter(draftStatus);
        setDateFilter(draftDate);
        setArrivalDateFilter(draftArrivalDate);
        setSourceFilter(draftSource);
        setDestFilter(draftDest);
        setSortBy(draftSortBy);
        setSortOrder(draftSortOrder);

        setCurrentPage(1);
        fetchFiltered(1, buildParams(activeSearch, draftStatus, draftDate, draftArrivalDate, draftSource, draftDest, draftSortBy, draftSortOrder));
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
            toast.error(parseApiError(err, 'Failed to update flight status'));
        }
    };

    return (
        <div className="admin-page">
            <div className="admin-container">

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
                        <div className="admin-toolbar-search">
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



                {/* Error */}
                {error && (
                    <div className="admin-error">
                        <AlertCircle size={16} />{error}
                    </div>
                )}

                {/* Table */}
                <div className="glass-card" style={{ borderRadius: 20, overflow: 'hidden' }}>
                    {loading ? (
                        <PageLoader fullScreen={true} label={t("admin.fetching", { defaultValue: 'Fetching flights...' })} />
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
                                            <td style={{ padding: '16px' }}><StatusBadge status={f.status} /></td>
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
                {filterOpen && (
                    <div className="admin-modal-overlay" onClick={() => setFilterOpen(false)}>
                        <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
                            <div className="admin-modal-header">
                                <h2 className="admin-modal-title">
                                    {t("admin.filtersAndSorting", { defaultValue: 'Filters & Sorting' })}
                                </h2>
                                <button className="btn-icon" onClick={() => setFilterOpen(false)}><X size={16} /></button>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
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


                                {/* Routing Section */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                    <div style={{ position: 'relative' }}>
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
                                                onFocus={() => setSourceFocus(true)}
                                                onBlur={() => setSourceFocus(false)}
                                                style={{ width: '100%', padding: '9px 12px 9px 34px', background: 'rgba(255,255,255,0.65)', border: '1.5px solid rgba(0,0,0,0.1)', borderRadius: 10, fontSize: 14, color: '#1a1c1d', fontFamily: 'Inter,sans-serif', outline: 'none', transition: 'border-color 0.2s, box-shadow 0.2s', boxSizing: 'border-box' }}
                                            />
                                        </div>
                                        {sourceFocus && getAirportSuggestions(draftSource).length > 0 && (
                                            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000, background: '#fff', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 8, maxHeight: 180, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', marginTop: 4 }}>
                                                {getAirportSuggestions(draftSource).map(apt => (
                                                    <div
                                                        key={apt.id}
                                                        onMouseDown={() => {
                                                            setDraftSource(apt.iata_code);
                                                            setSourceFocus(false);
                                                        }}
                                                        style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', gap: 2 }}
                                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(112,93,0,0.06)'}
                                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                                    >
                                                        <span style={{ fontWeight: 700, color: '#705d00', fontSize: 13 }}>{apt.iata_code}</span>
                                                        <span style={{ fontSize: 11, color: '#5e5e5e' }}>{apt.city} ({apt.airport_name})</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ position: 'relative' }}>
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
                                                onFocus={() => setDestFocus(true)}
                                                onBlur={() => setDestFocus(false)}
                                                style={{ width: '100%', padding: '9px 12px 9px 34px', background: 'rgba(255,255,255,0.65)', border: '1.5px solid rgba(0,0,0,0.1)', borderRadius: 10, fontSize: 14, color: '#1a1c1d', fontFamily: 'Inter,sans-serif', outline: 'none', transition: 'border-color 0.2s, box-shadow 0.2s', boxSizing: 'border-box' }}
                                            />
                                        </div>
                                        {destFocus && getAirportSuggestions(draftDest).length > 0 && (
                                            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000, background: '#fff', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 8, maxHeight: 180, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', marginTop: 4 }}>
                                                {getAirportSuggestions(draftDest).map(apt => (
                                                    <div
                                                        key={apt.id}
                                                        onMouseDown={() => {
                                                            setDraftDest(apt.iata_code);
                                                            setDestFocus(false);
                                                        }}
                                                        style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', gap: 2 }}
                                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(112,93,0,0.06)'}
                                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                                    >
                                                        <span style={{ fontWeight: 700, color: '#705d00', fontSize: 13 }}>{apt.iata_code}</span>
                                                        <span style={{ fontSize: 11, color: '#5e5e5e' }}>{apt.city} ({apt.airport_name})</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Status and Dates */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                    <Select
                                        label={t("admin.table.status", { defaultValue: 'Status' })}
                                        options={getStatusOptions(t)}
                                        value={draftStatus}
                                        onChange={(e) => setDraftStatus(e.target.value)}
                                    />
                                    <div />
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
                            </div>

                            <div className="flex flex-wrap items-center justify-end gap-3 pt-6 border-t border-slate-200 mt-8">
                                <button
                                    onClick={handleClearFilters}
                                    className="btn-secondary"
                                >
                                    {t("admin.modals.resetAll", { defaultValue: 'Reset All' })}
                                </button>
                                <button
                                    onClick={handleApplyFilters}
                                    className="btn-primary"
                                >
                                    {t("admin.modals.applyFilters", { defaultValue: 'Apply Filters' })}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Edit Status Modal */}
                {!!editTarget && !confirmOpen && (
                    <div className="admin-modal-overlay" onClick={() => setEditTarget(null)}>
                        <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
                            <div className="admin-modal-header">
                                <h2 className="admin-modal-title">Update Flight Status</h2>
                                <button className="btn-icon" onClick={() => setEditTarget(null)}><X size={16} /></button>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: '4px 0' }}>
                                {/* Flight identifier banner */}
                                <div style={{ background: 'rgba(112,93,0,0.06)', border: '1px solid rgba(112,93,0,0.12)', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <span style={{ fontSize: 18, fontWeight: 900, color: '#1a1c1d', letterSpacing: '-0.02em' }}>{editTarget.flight_number}</span>
                                    <span style={{ fontSize: 13, color: '#9e9488' }}>·</span>
                                    <span style={{ fontSize: 13, color: '#5e5e5e', fontWeight: 500 }}>
                                        {editTarget.route?.source?.iata_code} → {editTarget.route?.destination?.iata_code}
                                    </span>
                                </div>

                                {/* Status + Delay side by side */}
                                <div style={{ display: 'grid', gridTemplateColumns: editStatus === 'DELAYED' ? '1.4fr 1fr' : '1fr', gap: 14, alignItems: 'start' }}>
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
                                    {editStatus === 'DELAYED' && (
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
                                    )}
                                </div>

                                <div className="flex flex-wrap items-center justify-end gap-3 pt-6 border-t border-slate-200 mt-4">
                                    <button
                                        onClick={() => setEditTarget(null)}
                                        className="btn-secondary"
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
                                        className="btn-primary"
                                        style={{ opacity: actionLoading ? 0.7 : 1 }}
                                    >
                                        Save
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Confirmation Modal */}
                {confirmOpen && (
                    <div className="admin-modal-overlay" onClick={() => setConfirmOpen(false)}>
                        <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
                            <div className="admin-modal-header">
                                <h2 className="admin-modal-title">Confirm Update</h2>
                                <button className="btn-icon" onClick={() => setConfirmOpen(false)}><X size={16} /></button>
                            </div>

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
                                <div className="flex flex-wrap items-center justify-end gap-3 pt-6 border-t border-slate-200 mt-4">
                                    <button
                                        onClick={() => setConfirmOpen(false)}
                                        className="btn-secondary"
                                    >
                                        Go Back
                                    </button>
                                    <button
                                        onClick={handleStatusUpdate}
                                        disabled={actionLoading}
                                        className="btn-primary"
                                        style={{ opacity: actionLoading ? 0.7 : 1 }}
                                    >
                                        {actionLoading ? 'Updating...' : 'Confirm Update'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}