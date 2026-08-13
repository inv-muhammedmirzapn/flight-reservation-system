import { useEffect, useState, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { fetchFlightInstances, updateFlightInstance, fetchAirports } from '@/admin/_core/store/adminSlices';
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
        <span 
            className="rounded-full py-[3px] px-2.5 text-[11px] font-bold tracking-[0.04em] uppercase"
            style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}
        >
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
            toast.error(err?.detail || 'Failed to update flight status');
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
                <div className="glass-card rounded-2xl p-[14px_20px] mb-3 flex items-center justify-between gap-3 flex-wrap overflow-visible">
                    {/* Quick Search */}
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            setActiveSearch(searchInput);
                            setCurrentPage(1);
                            fetchFiltered(1, buildParams(searchInput, statusFilter, dateFilter, arrivalDateFilter, sourceFilter, destFilter, sortBy, sortOrder));
                        }}
                        className="flex items-center gap-2 flex-[1_1_300px] max-w-[480px]"
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
                            className="btn-primary px-[14px] py-[7px] text-[13px] shrink-0"
                        >
                            {t("admin.search", { defaultValue: 'Search' })}
                        </button>
                    </form>

                    <div className="flex items-center gap-3">
                        {/* Filter & Sort Modal Button */}
                        <button
                            onClick={handleOpenFilters}
                            className="flex items-center gap-2 px-5 py-2.5 bg-white/70 border-[1.5px] border-black/[0.08] rounded-xl text-sm font-semibold text-[#1a1c1d] cursor-pointer transition-all duration-200 shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:bg-white/90 hover:border-[#705d00]/20"
                        >
                            <SlidersHorizontal size={15} color="#705d00" />
                            <span>{t("admin.filtersAndSorting", { defaultValue: 'Filters & Sorting' })}</span>
                            {hasActiveFilters && (
                                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-[#705d00] text-white text-[10px] font-bold px-0.5">
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
                                className="px-4 py-2.5 bg-red-600/[0.08] border-[1.5px] border-red-600/[0.15] rounded-xl text-sm font-semibold text-red-600 cursor-pointer transition-colors duration-200 hover:bg-red-600/[0.12]"
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
                <div className="glass-card rounded-[20px] overflow-hidden">
                    {loading ? (
                        <div className="fixed inset-0 z-[9999] bg-[#f8fafc]/90 backdrop-blur-[10px] flex flex-col justify-center items-center">
                            <Plane size={48} color="#705d00" className="animate-bounce" />
                            <div className="mt-6 text-base font-semibold text-[#1a1c1d] font-ui">{t("admin.fetching", { defaultValue: 'Fetching flights...' })}</div>
                        </div>
                    ) : flights.length === 0 ? (
                        <div className="py-16 px-6 text-center">
                            <Plane size={44} color="#d0c6ab" className="mx-auto mb-4" />
                            <p className="font-bold text-base text-[#5e5e5e]">
                                {hasActiveFilters ? t("admin.noMatch", { defaultValue: 'No flights match your filters.' }) : t("admin.noFlights", { defaultValue: 'No flights registered yet.' })}
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-left">
                                <thead>
                                    <tr className="bg-white/50 border-b border-black/[0.06]">
                                        {[t("admin.table.flightNo", { defaultValue: 'Flight No.' }), t("admin.table.route", { defaultValue: 'Route' }), t("admin.table.times", { defaultValue: 'Times (Dep / Arr)' }), t("admin.table.gate", { defaultValue: 'Gate/Terminal' }), t("admin.table.status", { defaultValue: 'Status' }), t("admin.table.actions", { defaultValue: 'Actions' })].map(h => (
                                            <th key={h} className="py-[14px] px-4 text-[11px] font-bold tracking-[0.06em] uppercase text-[#5e5e5e] whitespace-nowrap">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {flights.map(f => (
                                        <tr key={f.id} className="admin-row border-b border-black/[0.05] transition-colors duration-200">
                                            <td className="p-4 font-extrabold text-sm text-[#1a1c1d] whitespace-nowrap">{f.flight_number}</td>
                                            <td className="p-4 font-bold text-sm text-[#1a1c1d] whitespace-nowrap">
                                                {f.route?.source?.iata_code}<span className="text-[#705d00] mx-1">→</span>{f.route?.destination?.iata_code}
                                            </td>
                                            <td className="p-4 text-xs text-[#5e5e5e] leading-[1.7]">
                                                <div>Dep: {fmtDT(f.scheduled_departure)}</div>
                                                <div>Arr: {fmtDT(f.scheduled_arrival)}</div>
                                            </td>
                                            <td className="p-4 text-[13px] text-[#5e5e5e] whitespace-nowrap">
                                                <div>Gate: {f.boarding_gate || '-'}</div>
                                                <div>Term: {f.departure_terminal || '-'} / {f.arrival_terminal || '-'}</div>
                                            </td>
                                            <td className="p-4"><Badge status={f.status} /></td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-1">
                                                    <button className="act p-2 rounded-lg text-[#5e5e5e] bg-transparent border-none cursor-pointer flex items-center transition-colors duration-200 hover:bg-black/5" onClick={() => { setEditTarget(f); setEditStatus(f.status); setEditDelay(f.delay_minutes || 0); }} title="Update Status"><Edit2 size={16} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {!loading && flights.length > 0 && (
                        <div className="px-5 pb-5">
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

                            <div className="flex flex-col gap-5">
                                {/* Sorting Section */}
                                <div>
                                    <label className="block text-[11px] font-bold tracking-[0.06em] uppercase text-[#5e5e5e] mb-2">{t("admin.modals.sortBy", { defaultValue: 'Sort By' })}</label>
                                    <div className="grid grid-cols-2 gap-3">
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
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="relative">
                                        <label className="block text-[11px] font-bold tracking-[0.06em] uppercase text-[#5e5e5e] mb-1.5">{t("admin.modals.sourceAirport", { defaultValue: 'Source Airport (IATA)' })}</label>
                                        <div className="relative">
                                            <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9e9488] pointer-events-none" />
                                            <input
                                                className="filter-input w-full p-[9px_12px_9px_34px] bg-white/65 border-[1.5px] border-black/10 rounded-[10px] text-sm text-[#1a1c1d] font-sans outline-none transition-all duration-200 box-border focus:border-[#705d00]/30 focus:shadow-[0_0_0_3px_rgba(112,93,0,0.08)]"
                                                type="text"
                                                placeholder="e.g. BOM"
                                                maxLength={5}
                                                value={draftSource}
                                                onChange={(e) => setDraftSource(e.target.value)}
                                                onFocus={() => setSourceFocus(true)}
                                                onBlur={() => setSourceFocus(false)}
                                            />
                                        </div>
                                        {sourceFocus && getAirportSuggestions(draftSource).length > 0 && (
                                            <div className="absolute top-full left-0 right-0 z-[1000] bg-white border border-black/10 rounded-lg max-h-[180px] overflow-y-auto shadow-[0_4px_12px_rgba(0,0,0,0.1)] mt-1">
                                                {getAirportSuggestions(draftSource).map(apt => (
                                                    <div
                                                        key={apt.id}
                                                        onMouseDown={() => {
                                                            setDraftSource(apt.iata_code);
                                                            setSourceFocus(false);
                                                        }}
                                                        className="p-[8px_12px] cursor-pointer border-b border-black/[0.04] flex flex-col gap-0.5 hover:bg-[#705d00]/[0.06] transition-colors duration-200"
                                                    >
                                                        <span className="font-bold text-[#705d00] text-[13px]">{apt.iata_code}</span>
                                                        <span className="text-[11px] text-[#5e5e5e]">{apt.city} ({apt.airport_name})</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="relative">
                                        <label className="block text-[11px] font-bold tracking-[0.06em] uppercase text-[#5e5e5e] mb-1.5">{t("admin.modals.destAirport", { defaultValue: 'Destination Airport (IATA)' })}</label>
                                        <div className="relative">
                                            <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9e9488] pointer-events-none" />
                                            <input
                                                className="filter-input w-full p-[9px_12px_9px_34px] bg-white/65 border-[1.5px] border-black/10 rounded-[10px] text-sm text-[#1a1c1d] font-sans outline-none transition-all duration-200 box-border focus:border-[#705d00]/30 focus:shadow-[0_0_0_3px_rgba(112,93,0,0.08)]"
                                                type="text"
                                                placeholder="e.g. DEL"
                                                maxLength={5}
                                                value={draftDest}
                                                onChange={(e) => setDraftDest(e.target.value)}
                                                onFocus={() => setDestFocus(true)}
                                                onBlur={() => setDestFocus(false)}
                                            />
                                        </div>
                                        {destFocus && getAirportSuggestions(draftDest).length > 0 && (
                                            <div className="absolute top-full left-0 right-0 z-[1000] bg-white border border-black/10 rounded-lg max-h-[180px] overflow-y-auto shadow-[0_4px_12px_rgba(0,0,0,0.1)] mt-1">
                                                {getAirportSuggestions(draftDest).map(apt => (
                                                    <div
                                                        key={apt.id}
                                                        onMouseDown={() => {
                                                            setDraftDest(apt.iata_code);
                                                            setDestFocus(false);
                                                        }}
                                                        className="p-[8px_12px] cursor-pointer border-b border-black/[0.04] flex flex-col gap-0.5 hover:bg-[#705d00]/[0.06] transition-colors duration-200"
                                                    >
                                                        <span className="font-bold text-[#705d00] text-[13px]">{apt.iata_code}</span>
                                                        <span className="text-[11px] text-[#5e5e5e]">{apt.city} ({apt.airport_name})</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Status and Dates */}
                                <div className="grid grid-cols-2 gap-3">
                                    <Select
                                        label={t("admin.table.status", { defaultValue: 'Status' })}
                                        options={getStatusOptions(t)}
                                        value={draftStatus}
                                        onChange={(e) => setDraftStatus(e.target.value)}
                                    />
                                    <div />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
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

                            <div className="flex flex-col gap-[18px] py-1">
                                {/* Flight identifier banner */}
                                <div className="bg-[#705d00]/[0.06] border border-[#705d00]/[0.12] rounded-[10px] py-2.5 px-3.5 flex items-center gap-2.5">
                                    <span className="text-lg font-black text-[#1a1c1d] tracking-[-0.02em]">{editTarget.flight_number}</span>
                                    <span className="text-[13px] text-[#9e9488]">·</span>
                                    <span className="text-[13px] text-[#5e5e5e] font-medium">
                                        {editTarget.route?.source?.iata_code} → {editTarget.route?.destination?.iata_code}
                                    </span>
                                </div>

                                {/* Status + Delay side by side */}
                                <div className="grid gap-[14px] items-start" style={{ gridTemplateColumns: editStatus === 'DELAYED' ? '1.4fr 1fr' : '1fr' }}>
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
                                        <div className="flex flex-col gap-1.5 max-w-[140px]">
                                            <label className="text-[11px] font-bold tracking-[0.06em] uppercase text-[#5e5e5e]">Delay (min)</label>
                                            <div className="flex items-center border-[1.5px] border-black/[0.15] rounded-[9px] overflow-hidden bg-white h-[38px]">
                                                <button
                                                    type="button"
                                                    onClick={() => { const v = Math.max(0, editDelay - 5); setEditDelay(v); if (v === 0 && editStatus === 'DELAYED') setEditStatus('SCHEDULED'); }}
                                                    className="w-[34px] h-full border-none bg-black/[0.03] border-r border-black/[0.09] text-lg font-bold cursor-pointer text-[#5e5e5e] flex items-center justify-center shrink-0 transition-colors hover:bg-black/[0.06]"
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
                                                    className="flex-1 min-w-0 w-full border-none outline-none text-center text-[15px] font-extrabold font-sans text-[#1a1c1d] bg-transparent"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => { const v = Math.min(999, editDelay + 5); setEditDelay(v); setEditStatus('DELAYED'); }}
                                                    className="w-[34px] h-full border-none bg-black/[0.03] border-l border-black/[0.09] text-lg font-bold cursor-pointer text-[#5e5e5e] flex items-center justify-center shrink-0 transition-colors hover:bg-black/[0.06]"
                                                >+</button>
                                            </div>
                                            {editDelay > 0 ? (
                                                <span className="text-[10px] text-[#92400e] font-semibold">⚠ Auto-sets to Delayed</span>
                                            ) : (
                                                <span className="text-[10px] text-[#9e9488]">0 = no delay</span>
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
                                        className={`btn-primary ${actionLoading ? 'opacity-70' : ''}`}
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

                            <div className="flex flex-col gap-5 py-3 px-1">
                                <p className="text-sm text-[#1a1c1d] m-0 leading-[1.7]">
                                    You are about to update <strong>{editTarget?.flight_number}</strong>:
                                </p>
                                <div className="bg-[#705d00]/[0.06] rounded-[10px] p-[14px_16px] flex flex-col gap-2">
                                    <div className="text-[13px] flex justify-between">
                                        <span className="text-[#5e5e5e] font-semibold">Status</span>
                                        <span className="font-extrabold text-[#1a1c1d]">{editStatus}</span>
                                    </div>
                                    <div className="text-[13px] flex justify-between">
                                        <span className="text-[#5e5e5e] font-semibold">Delay</span>
                                        <span className={`font-extrabold ${editDelay > 0 ? 'text-[#92400e]' : 'text-[#1a1c1d]'}`}>
                                            {editDelay > 0 ? `${editDelay} minutes` : 'No delay'}
                                        </span>
                                    </div>
                                </div>
                                <p className="text-xs text-[#9e9488] m-0">This will update the live flight record and notify affected passengers.</p>
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
                                        className={`btn-primary ${actionLoading ? 'opacity-70' : ''}`}
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