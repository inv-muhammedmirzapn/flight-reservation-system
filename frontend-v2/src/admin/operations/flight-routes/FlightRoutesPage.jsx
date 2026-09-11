/**
 * FlightRoutesPage — list + create/edit form for FlightRoute with dynamic nested Flight Leg rows.
 * leg_order is auto-assigned by row position.
 * Cross-row layover validation: each leg's departure must be after prev leg's arrival.
 */
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { fetchWithAuth } from '@/services/apiClient';
import { Input } from '@/components/ui/Input';
import { TimePicker } from '@/components/ui/TimePicker';
import '@/admin/_core/styles/admin.css';
import DeleteConfirmationModal from '../../_core/DeleteConfirmationModal';
import { Select } from '@/components/ui/Select';
import {
  fetchFlightRoutes, addFlightRoute, updateFlightRoute, removeFlightRoute,
  flightRouteActions,
  ADMIN_PAGE_SIZE,
} from '@/admin/_core/store/adminSlices';
import { Pagination } from '@/components/ui/Pagination';
import {
  Plus, Pencil, Trash2, Save, X, AlertCircle, ChevronRight,
  Search, PlusCircle, MinusCircle, MapPin, Tag, Clock, Calendar, Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';
import useDeleteAction from '../../_core/hooks/useDeleteAction';
import { SpinnerLoader } from '@/components/ui/Loaders';
import { parseApiError } from '@/utils/errorUtils';

const DAYS_OF_WEEK = [
  { id: '1', short: 'Mon', label: 'Monday' },
  { id: '2', short: 'Tue', label: 'Tuesday' },
  { id: '3', short: 'Wed', label: 'Wednesday' },
  { id: '4', short: 'Thu', label: 'Thursday' },
  { id: '5', short: 'Fri', label: 'Friday' },
  { id: '6', short: 'Sat', label: 'Saturday' },
  { id: '7', short: 'Sun', label: 'Sunday' },
];

const formatDays = (daysStr) => {
  if (!daysStr) return 'None';
  const parts = daysStr.split(',').map((d) => d.trim()).filter(Boolean);
  if (parts.length === 7) return 'Daily';
  if (parts.length === 5 && !parts.includes('6') && !parts.includes('7')) return 'Weekdays';
  if (parts.length === 2 && parts.includes('6') && parts.includes('7')) return 'Weekends';
  const dayNames = { '1': 'Mon', '2': 'Tue', '3': 'Wed', '4': 'Thu', '5': 'Fri', '6': 'Sat', '7': 'Sun' };
  return parts.map((d) => dayNames[d] || d).join(', ');
};

// ─── Time calculation & formatting helpers ────────────────────────────────────
const timeToMinutes = (str) => {
  if (!str) return 0;
  const [h, m] = str.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

const minutesToTime = (totalMins) => {
  const norm = ((totalMins % 1440) + 1440) % 1440;
  const h = Math.floor(norm / 60);
  const m = norm % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const addMinutesToTime = (timeStr, mins) => {
  return minutesToTime(timeToMinutes(timeStr) + (Number(mins) || 0));
};

const diffMinutes = (startStr, endStr) => {
  const start = timeToMinutes(startStr);
  const end = timeToMinutes(endStr);
  if (end >= start) return end - start;
  return (end + 1440) - start; // crossed midnight
};

const formatTime12h = (timeStr) => {
  if (!timeStr) return '--:--';
  const [hStr, mStr] = timeStr.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr || '00';
  if (isNaN(h)) return timeStr;
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${String(h).padStart(2, '0')}:${m} ${ampm}`;
};

const formatMins = (mins) => {
  if (!mins) return '0m';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
};

const EMPTY_LEG = {
  departure_airport: '',
  arrival_airport: '',
  flight_duration_minutes: 120,
  layover_duration_minutes: 0,
  scheduled_departure_time: '08:00',
  scheduled_arrival_time: '10:00',
};

const EMPTY_FORM = {
  flight_no: '',
  airline: '',
  operates_on_days: '1,2,3,4,5,6,7',
  scheduled_departure_time: '08:00',
  scheduled_arrival_time: '10:00',
  baggage_weight_allowed_per_person: '20',
  baggage_number_allowed_per_person: '',
  handbag_weight_allowed_per_person: '7',
  max_extra_baggage_kg_per_person: '20',
  extra_baggage_price_per_kg: '500',
  extra_baggage_currency: 'INR',
  legs: [{ ...EMPTY_LEG }],
};

export default function FlightRoutesPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightRoute = searchParams.get('highlightRoute') || sessionStorage.getItem('highlightRoute');
  const { items: routes, loading, actionLoading, count, error, validationErrors } = useSelector((s) => s.flightRoute);
  const [airlines, setAirlines] = useState([]);
  const [airports, setAirports] = useState([]);

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [localErrors, setLocalErrors] = useState({});
  const [search, setSearch] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [searchFocus, setSearchFocus] = useState(false);
  const [isFlightNoFocused, setIsFlightNoFocused] = useState(false);
  const pageParam = parseInt(searchParams.get('page') || '1', 10);
  const initialPage = isNaN(pageParam) ? 1 : pageParam;
  const [page, setPage] = useState(initialPage);

  const searchSuggestions = useMemo(() => {
    if (!search || search.trim().length < 2 || !routes) return [];
    const q = search.toLowerCase().trim();
    const map = new Map();
    routes.forEach(r => {
      if (r.flight_no?.toLowerCase().includes(q)) map.set(r.flight_no, 'Flight No');
      if (r.airline_name?.toLowerCase().includes(q)) map.set(r.airline_name, 'Airline');
      (r.legs || []).forEach(leg => {
        if (leg.departure_airport_iata?.toLowerCase().includes(q)) map.set(leg.departure_airport_iata, 'Airport Code');
        if (leg.arrival_airport_iata?.toLowerCase().includes(q)) map.set(leg.arrival_airport_iata, 'Airport Code');
      });
    });
    return Array.from(map.entries()).map(([value, category]) => ({ value, category })).slice(0, 5);
  }, [search, routes]);

  const load = useCallback((s, p) => {
    dispatch(fetchFlightRoutes({ search: s, page: p }));
  }, [dispatch]);

  const pageStr = searchParams.get('page') || '1';

  useEffect(() => {
    const p = parseInt(pageStr, 10);
    const resolvedPage = isNaN(p) ? 1 : p;
    setPage(resolvedPage);
    load(activeSearch, resolvedPage);
  }, [pageStr, activeSearch, load]);

  // Keep sessionStorage in sync and scroll to highlighted row
  useEffect(() => {
    if (highlightRoute) {
      sessionStorage.setItem('highlightRoute', String(highlightRoute));
      const timer = setTimeout(() => {
        const el = document.querySelector('.admin-row-highlight');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [highlightRoute, routes]);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      const activeHighlight = searchParams.get('highlightRoute') || sessionStorage.getItem('highlightRoute');
      if (!activeHighlight) return;

      // Ignore clicks on disconnected elements (e.g. dropdown items or modals unmounted on click)
      if (!e.target || !e.target.isConnected) return;

      // Check composedPath for any interactive, header, or nav ancestor
      const path = typeof e.composedPath === 'function' ? e.composedPath() : [];
      const isInteractiveOrNav = path.some((el) => {
        if (!el || !el.tagName) return false;
        const tag = el.tagName.toLowerCase();
        if (
          tag === 'a' ||
          tag === 'button' ||
          tag === 'nav' ||
          tag === 'header' ||
          tag === 'input' ||
          tag === 'select' ||
          tag === 'textarea'
        ) {
          return true;
        }
        if (el.classList) {
          if (
            el.classList.contains('admin-navbar') ||
            el.classList.contains('admin-sidebar') ||
            el.classList.contains('admin-modal') ||
            el.classList.contains('toast') ||
            el.classList.contains('admin-toolbar-search')
          ) {
            return true;
          }
        }
        return false;
      });
      if (isInteractiveOrNav) return;

      if (
        e.target.closest('a') ||
        e.target.closest('button') ||
        e.target.closest('nav') ||
        e.target.closest('header') ||
        e.target.closest('.admin-navbar') ||
        e.target.closest('.admin-sidebar') ||
        e.target.closest('.admin-modal') ||
        e.target.closest('.toast')
      ) {
        return;
      }

      const tableContainer = document.querySelector('.admin-table-wrap');
      if (tableContainer && !tableContainer.contains(e.target)) {
        sessionStorage.removeItem('highlightRoute');
        setSearchParams((prev) => {
          if (!prev.has('highlightRoute')) return prev;
          const nextParams = new URLSearchParams(prev);
          nextParams.delete('highlightRoute');
          return nextParams;
        });
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => {
      document.removeEventListener('click', handleOutsideClick);
    };
  }, [searchParams, setSearchParams]);

  const handleRowClick = (e, routeId) => {
    const tag = e.target.tagName.toLowerCase();
    if (
      tag === 'button' ||
      tag === 'a' ||
      tag === 'input' ||
      tag === 'svg' ||
      tag === 'path' ||
      e.target.closest('a') ||
      e.target.closest('button') ||
      e.target.closest('input')
    ) {
      return;
    }
    const currentHighlight = searchParams.get('highlightRoute') || sessionStorage.getItem('highlightRoute');
    if (currentHighlight === String(routeId)) {
      sessionStorage.removeItem('highlightRoute');
      setSearchParams((prev) => {
        const nextParams = new URLSearchParams(prev);
        nextParams.delete('highlightRoute');
        return nextParams;
      });
    } else {
      sessionStorage.setItem('highlightRoute', String(routeId));
      setSearchParams((prev) => {
        const nextParams = new URLSearchParams(prev);
        nextParams.set('highlightRoute', String(routeId));
        return nextParams;
      });
    }
  };

  const loadLookups = () => {
    fetchWithAuth('/flights/v2/airlines/?page_size=1000')
      .then((data) => setAirlines(data.results || data || []))
      .catch((err) => console.error('Failed to load airlines lookup:', err));
    fetchWithAuth('/flights/v2/airports/?page_size=1000')
      .then((data) => setAirports(data.results || data || []))
      .catch((err) => console.error('Failed to load airports lookup:', err));
  };

  const airlineOptions = airlines.map((a) => ({ value: a.id, label: `${a.iata_airline_code} – ${a.airline_name}` }));
  const airportOptions = airports.map((a) => ({ value: a.id, label: `${a.iata_code} – ${a.airport_name}` }));

  const openCreate = () => {
    loadLookups();
    dispatch(flightRouteActions.clearErrors());
    setEditId(null);
    setForm(EMPTY_FORM);
    setLocalErrors({});
    setShowForm(true);
  };

  const openEdit = (route) => {
    loadLookups();
    dispatch(flightRouteActions.clearErrors());
    setEditId(route.id);
    const selectedAirline = airlines.find((a) => String(a.id) === String(route.airline));
    let numericFlightNo = route.flight_no || '';
    if (selectedAirline && selectedAirline.iata_airline_code) {
      const regex = new RegExp(`^${selectedAirline.iata_airline_code}[-]?`, 'i');
      numericFlightNo = numericFlightNo.replace(regex, '');
    }

    const loadedLegs = (route.legs || []).map((leg) => {
      const depT = leg.scheduled_departure_time ? leg.scheduled_departure_time.substring(0, 5) : '08:00';
      const dur = Number(leg.flight_duration_minutes) || 120;
      const arrT = leg.scheduled_arrival_time ? leg.scheduled_arrival_time.substring(0, 5) : addMinutesToTime(depT, dur);
      return {
        departure_airport: leg.departure_airport,
        arrival_airport: leg.arrival_airport,
        flight_duration_minutes: dur,
        layover_duration_minutes: leg.layover_duration_minutes || 0,
        scheduled_departure_time: depT,
        scheduled_arrival_time: arrT,
      };
    });

    const finalLegs = loadedLegs.length > 0 ? loadedLegs : [{ ...EMPTY_LEG }];
    const overallDep = finalLegs[0]?.scheduled_departure_time || (route.scheduled_departure_time ? route.scheduled_departure_time.substring(0, 5) : '08:00');
    const overallArr = finalLegs[finalLegs.length - 1]?.scheduled_arrival_time || (route.scheduled_arrival_time ? route.scheduled_arrival_time.substring(0, 5) : '10:00');

    setForm({
      flight_no: numericFlightNo,
      airline: route.airline || '',
      operates_on_days: route.operates_on_days || '1,2,3,4,5,6,7',
      scheduled_departure_time: overallDep,
      scheduled_arrival_time: overallArr,
      baggage_weight_allowed_per_person: route.baggage_weight_allowed_per_person || '20',
      baggage_number_allowed_per_person: route.baggage_number_allowed_per_person ?? '',
      handbag_weight_allowed_per_person: route.handbag_weight_allowed_per_person || '7',
      max_extra_baggage_kg_per_person: route.max_extra_baggage_kg_per_person ?? '20',
      extra_baggage_price_per_kg: route.extra_baggage_price_per_kg ?? '500',
      extra_baggage_currency: route.extra_baggage_currency || 'INR',
      legs: finalLegs,
    });
    setLocalErrors({});
    setShowForm(true);
  };

  const closeForm = () => { setShowForm(false); setEditId(null); dispatch(flightRouteActions.clearErrors()); };

  // ─── Leg management ─────────────────────────────────────────────────────────
  const addLeg = () => setForm((f) => {
    const newLeg = { ...EMPTY_LEG };
    if (f.legs.length > 0) {
      const prevLeg = f.legs[f.legs.length - 1];
      newLeg.departure_airport = prevLeg.arrival_airport;
      newLeg.layover_duration_minutes = 60; // 1 hour default layover
      const depTime = prevLeg.scheduled_arrival_time ? addMinutesToTime(prevLeg.scheduled_arrival_time, 60) : '11:00';
      newLeg.scheduled_departure_time = depTime;
      newLeg.flight_duration_minutes = 120;
      newLeg.scheduled_arrival_time = addMinutesToTime(depTime, 120);
    } else {
      newLeg.scheduled_departure_time = f.scheduled_departure_time || '08:00';
      newLeg.flight_duration_minutes = 120;
      newLeg.scheduled_arrival_time = addMinutesToTime(newLeg.scheduled_departure_time, 120);
    }
    const nextLegs = [...f.legs, newLeg];
    return {
      ...f,
      legs: nextLegs,
      scheduled_departure_time: nextLegs[0]?.scheduled_departure_time || f.scheduled_departure_time,
      scheduled_arrival_time: nextLegs[nextLegs.length - 1]?.scheduled_arrival_time || f.scheduled_arrival_time,
    };
  });

  const removeLeg = (i) => setForm((f) => {
    const remaining = f.legs.filter((_, idx) => idx !== i);
    for (let idx = 1; idx < remaining.length; idx++) {
      remaining[idx] = { ...remaining[idx], departure_airport: remaining[idx - 1].arrival_airport };
    }
    return {
      ...f,
      legs: remaining,
      scheduled_departure_time: remaining[0]?.scheduled_departure_time || f.scheduled_departure_time,
      scheduled_arrival_time: remaining[remaining.length - 1]?.scheduled_arrival_time || f.scheduled_arrival_time,
    };
  });

  const updateLeg = (i, key, val) =>
    setForm((f) => {
      let nextLegs = f.legs.map((l, idx) => (idx === i ? { ...l, [key]: val } : { ...l }));

      // Airport continuity
      if (key === 'arrival_airport' && nextLegs[i + 1]) {
        nextLegs[i + 1].departure_airport = val;
      }

      // Departure time changed
      if (key === 'scheduled_departure_time') {
        if (val) {
          const currentArr = nextLegs[i].scheduled_arrival_time;
          if (currentArr) {
            const mins = diffMinutes(val, currentArr);
            if (mins > 0 && mins < 1440) {
              nextLegs[i].flight_duration_minutes = mins;
            } else {
              const prevDur = Number(nextLegs[i].flight_duration_minutes) || 120;
              nextLegs[i].scheduled_arrival_time = addMinutesToTime(val, prevDur);
            }
          } else {
            const prevDur = Number(nextLegs[i].flight_duration_minutes) || 120;
            nextLegs[i].scheduled_arrival_time = addMinutesToTime(val, prevDur);
          }
        }
      }

      // Arrival time changed -> automatically calculate flight duration
      if (key === 'scheduled_arrival_time') {
        if (val && nextLegs[i].scheduled_departure_time) {
          const calcMins = diffMinutes(nextLegs[i].scheduled_departure_time, val);
          nextLegs[i].flight_duration_minutes = calcMins > 0 ? calcMins : 0;
        }
      }

      // Layover changed on leg i -> update departure & arrival of leg i
      if (key === 'layover_duration_minutes' && i > 0) {
        const prevArr = nextLegs[i - 1]?.scheduled_arrival_time;
        const layover = Number(val) || 0;
        if (prevArr) {
          const newDep = addMinutesToTime(prevArr, layover);
          nextLegs[i].scheduled_departure_time = newDep;
          const dur = Number(nextLegs[i].flight_duration_minutes) || 120;
          nextLegs[i].scheduled_arrival_time = addMinutesToTime(newDep, dur);
        }
      }

      // Cascade timing changes to subsequent legs
      if (['scheduled_departure_time', 'scheduled_arrival_time', 'layover_duration_minutes'].includes(key)) {
        for (let k = i + 1; k < nextLegs.length; k++) {
          const prevArr = nextLegs[k - 1]?.scheduled_arrival_time;
          if (prevArr) {
            const layover = Number(nextLegs[k].layover_duration_minutes) || 0;
            const newDep = addMinutesToTime(prevArr, layover);
            nextLegs[k].scheduled_departure_time = newDep;
            const dur = Number(nextLegs[k].flight_duration_minutes) || 120;
            nextLegs[k].scheduled_arrival_time = addMinutesToTime(newDep, dur);
          }
        }
      }

      const routeDep = nextLegs[0]?.scheduled_departure_time || f.scheduled_departure_time;
      const routeArr = nextLegs[nextLegs.length - 1]?.scheduled_arrival_time || f.scheduled_arrival_time;

      return {
        ...f,
        legs: nextLegs,
        scheduled_departure_time: routeDep,
        scheduled_arrival_time: routeArr,
      };
    });

  // ─── Validation ──────────────────────────────────────────────────────────────
  const validateForm = () => {
    const e = {};
    if (!form.flight_no || !/^\d+$/.test(form.flight_no.trim())) {
      e.flight_no = 'Flight number must be numeric (e.g., 202).';
    }
    if (!form.airline) e.airline = 'Airline is required.';
    if (!form.operates_on_days) e.operates_on_days = 'Select at least one operating day.';
    if (form.legs.length === 0) e.legs = 'At least one leg is required.';
    if (Number(form.baggage_weight_allowed_per_person) < 0) e.baggage_weight_allowed_per_person = 'Cannot be negative.';
    if (form.baggage_number_allowed_per_person !== '' && form.baggage_number_allowed_per_person !== null) {
      const bagNum = Number(form.baggage_number_allowed_per_person);
      if (isNaN(bagNum) || !Number.isInteger(bagNum) || bagNum < 0) {
        e.baggage_number_allowed_per_person = 'Must be a non-negative whole number.';
      }
    }
    if (Number(form.handbag_weight_allowed_per_person) < 0) e.handbag_weight_allowed_per_person = 'Cannot be negative.';
    if (Number(form.max_extra_baggage_kg_per_person) < 0) e.max_extra_baggage_kg_per_person = 'Cannot be negative.';
    if (Number(form.extra_baggage_price_per_kg) < 0) e.extra_baggage_price_per_kg = 'Cannot be negative.';

    // Continuity and individual leg checks
    for (let i = 1; i < form.legs.length; i++) {
      const prevLeg = form.legs[i - 1];
      const currLeg = form.legs[i];
      if (currLeg.departure_airport && prevLeg.arrival_airport && currLeg.departure_airport !== prevLeg.arrival_airport) {
        e[`leg_${i}_dep_apt`] = `Leg ${i + 1} departure must match Leg ${i} arrival airport.`;
      }
    }

    form.legs.forEach((leg, i) => {
      if (!leg.departure_airport) e[`leg_${i}_dep_apt`] = 'Departure airport required.';
      if (!leg.arrival_airport) e[`leg_${i}_arr_apt`] = 'Arrival airport required.';
      if (leg.departure_airport && leg.arrival_airport && leg.departure_airport === leg.arrival_airport) {
        e[`leg_${i}_arr_apt`] = 'Arrival must differ from departure.';
      }
      if (!leg.scheduled_departure_time) e[`leg_${i}_dep_time`] = 'Leg departure time required.';
      if (!leg.scheduled_arrival_time) e[`leg_${i}_arr_time`] = 'Leg arrival time required.';
      if (!leg.flight_duration_minutes || Number(leg.flight_duration_minutes) <= 0) {
        e[`leg_${i}_duration`] = 'Flight duration must be > 0 mins.';
      }
      if (i > 0 && Number(leg.layover_duration_minutes) < 0) {
        e[`leg_${i}_layover`] = 'Layover duration cannot be negative.';
      }
    });

    setLocalErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e, goNext = false) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!validateForm()) { toast.error('Fix validation errors.'); return; }

    const selectedAirline = airlines.find((a) => String(a.id) === String(form.airline));
    const prefix = selectedAirline ? `${selectedAirline.iata_airline_code}-` : '';
    const fullFlightNo = `${prefix}${form.flight_no.trim()}`;

    const routeDepTime = form.legs[0]?.scheduled_departure_time || form.scheduled_departure_time;
    const routeArrTime = form.legs[form.legs.length - 1]?.scheduled_arrival_time || form.scheduled_arrival_time;

    const payload = {
      ...form,
      flight_no: fullFlightNo,
      scheduled_departure_time: routeDepTime ? `${routeDepTime}:00` : null,
      scheduled_arrival_time: routeArrTime ? `${routeArrTime}:00` : null,
      baggage_weight_allowed_per_person: form.baggage_weight_allowed_per_person ? Number(form.baggage_weight_allowed_per_person) : 20,
      baggage_number_allowed_per_person: form.baggage_number_allowed_per_person ? Number(form.baggage_number_allowed_per_person) : null,
      handbag_weight_allowed_per_person: form.handbag_weight_allowed_per_person ? Number(form.handbag_weight_allowed_per_person) : 7,
      max_extra_baggage_kg_per_person: form.max_extra_baggage_kg_per_person ? Number(form.max_extra_baggage_kg_per_person) : 0,
      extra_baggage_price_per_kg: form.extra_baggage_price_per_kg ? Number(form.extra_baggage_price_per_kg) : 0,
      extra_baggage_currency: form.extra_baggage_currency || 'INR',
      legs: form.legs.map((leg, i) => ({
        ...leg,
        leg_order: i + 1,
        flight_duration_minutes: Number(leg.flight_duration_minutes),
        layover_duration_minutes: i > 0 ? Number(leg.layover_duration_minutes) : 0,
        scheduled_departure_time: leg.scheduled_departure_time ? `${leg.scheduled_departure_time}:00` : null,
        scheduled_arrival_time: leg.scheduled_arrival_time ? `${leg.scheduled_arrival_time}:00` : null,
      })),
    };

    let promise;
    if (editId) {
      promise = dispatch(updateFlightRoute({ id: editId, data: payload })).unwrap();
    } else {
      promise = dispatch(addFlightRoute(payload)).unwrap();
    }

    try {
      const res = await promise;
      toast.success('Flight route saved!');
      closeForm();
      const routeId = res?.id || editId;
      if (goNext && routeId) {
        navigate(`/admin/operations/route-fare-classes?route=${routeId}&autoOpen=true&fromPage=${page}`);
      } else {
        load(activeSearch, page);
      }
    } catch (err) {
      toast.error(parseApiError(err, 'Failed to save.'));
    }
  };

  const { deleteItem, setDeleteItem, deleteLoading, confirmDelete } = useDeleteAction({
    thunk: removeFlightRoute,
    onSuccess: () => load(activeSearch, page),
    successMessage: 'Flight route deleted successfully.',
    errorMessage: 'Failed to delete flight route.'
  });

  const totalPages = count ? Math.ceil(count / ADMIN_PAGE_SIZE) : 1;

  return (
    <div className="admin-page">
      <div className="admin-container">
        <div className="flex justify-between items-center mb-7">
          <div>
            <h1 className="admin-page-title">Flight Routes</h1>
            <p className="admin-page-subtitle">{count} total routes</p>
          </div>
          <button className="btn-primary" onClick={openCreate} id="add-flight-route-btn">
            <Plus size={15} /> Add Route
          </button>
        </div>

        {/* Search */}
        <form onSubmit={(e) => { e.preventDefault(); setActiveSearch(search); setPage(1); }} className="flex gap-2 mb-5">
          <div className="admin-toolbar-search relative">
            <Search size={14} className="search-icon" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => setSearchFocus(true)}
              onBlur={() => setSearchFocus(false)}
              placeholder="Search by flight number…"
            />
            {searchFocus && searchSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-[1000] bg-white border border-black/10 rounded-lg max-h-[180px] overflow-y-auto shadow-[0_4px_12px_rgba(0,0,0,0.1)] mt-1">
                {searchSuggestions.map((sug, idx) => (
                  <div
                    key={idx}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setSearch(sug.value);
                      setActiveSearch(sug.value);
                      setPage(1);
                      setSearchFocus(false);
                    }}
                    className={`px-3 py-2 cursor-pointer flex items-center justify-between gap-1.5 transition-colors hover:bg-[rgba(112,93,0,0.06)] ${idx < searchSuggestions.length - 1 ? 'border-b border-black/[0.04]' : ''
                      }`}
                  >
                    <span className="font-semibold text-[#1a1c1d] text-[13px]">{sug.value}</span>
                    <span className="text-[11px] text-[#888] uppercase tracking-[0.05em] font-bold">{sug.category}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button type="submit" className="btn-primary">Search</button>
        </form>

        {error && (
          <div className="admin-error">
            <AlertCircle size={16} /><span>{typeof error === 'string' ? error : JSON.stringify(error)}</span>
          </div>
        )}

        {/* Table */}
        <div className="admin-card admin-table-wrap fr-table">
          {loading ? (
            <SpinnerLoader />
          ) : routes?.length === 0 ? (
            <div className="admin-empty">
              <div className="admin-empty-icon"><MapPin size={28} /></div>
              <h3>No flight routes yet</h3>
              <p>Click &ldquo;Add Route&rdquo; to create one.</p>
              <button className="btn-primary" onClick={openCreate}><Plus size={14} /> Add Route</button>
            </div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Flight No</th>
                  <th>Airline</th>
                  <th>Schedule &amp; Days</th>
                  <th>Legs &amp; Duration</th>
                  <th>Baggage (kg)</th>
                  <th>Handbag (kg)</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {routes.map((r) => {
                  const isHighlighted = String(r.id) === String(highlightRoute);
                  return (
                    <tr
                      key={r.id}
                      onClick={(e) => handleRowClick(e, r.id)}
                      className={`admin-row cursor-pointer ${isHighlighted ? 'admin-row-highlight' : ''}`}
                    >
                      <td><strong>{r.flight_no}</strong></td>
                      <td>{r.airline_name || r.airline}</td>
                      <td>
                        <div className="flex flex-col text-xs font-semibold gap-0.5">
                          <span className="text-[#1a1c1d] flex items-center gap-1">
                            <Clock size={11} className="text-[#705d00]" />
                            {r.scheduled_departure_time ? r.scheduled_departure_time.substring(0, 5) : '--:--'} – {r.scheduled_arrival_time ? r.scheduled_arrival_time.substring(0, 5) : '--:--'}
                          </span>
                          <span className="text-[10px] text-slate-500 font-medium">
                            {formatDays(r.operates_on_days)}
                          </span>
                        </div>
                      </td>
                      <td className="fr-legs-cell">
                        <div className="flex flex-col gap-1">
                          {(r.legs || []).map((leg, i) => (
                            <div key={i} className="flex flex-col gap-0.5">
                              {i > 0 && (
                                <div className="fr-layover-row flex items-center gap-1 pl-1">
                                  <div className="w-px h-3 bg-[#ccc]" />
                                  <span className="fr-layover-pill text-[10px] text-[#888] bg-black/5 px-1.5 py-px rounded leading-none">
                                    Layover {formatMins(leg.layover_duration_minutes)}
                                  </span>
                                </div>
                              )}
                              <span className="fr-leg-badge text-[11px] bg-[rgba(112,93,0,0.08)] rounded-md px-2 py-0.5 font-semibold whitespace-nowrap w-max">
                                {leg.departure_airport_iata || leg.departure_airport} → {leg.arrival_airport_iata || leg.arrival_airport}
                                <span className="text-[#666] font-normal ml-1">({leg.scheduled_departure_time?.substring(0, 5)} - {leg.scheduled_arrival_time?.substring(0, 5)}, {formatMins(leg.flight_duration_minutes)})</span>
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td>{r.baggage_weight_allowed_per_person}</td>
                      <td>{r.handbag_weight_allowed_per_person}</td>
                      <td className="text-right whitespace-nowrap">
                        <div className="flex gap-1.5 items-center justify-end">
                          <button
                            className="btn-secondary py-1 px-2 text-[11px] flex items-center gap-1"
                            title="Route Fare Templates"
                            onClick={() => {
                              sessionStorage.setItem('highlightRoute', String(r.id));
                              navigate(`/admin/operations/route-fare-classes?route=${r.id}&fromPage=${page}&highlightRoute=${r.id}`);
                            }}
                          >
                            <Tag size={12} className="text-[#705d00]" /> Fares
                          </button>
                          <button
                            className="btn-secondary py-1.5 px-2"
                            title="Edit"
                            onClick={() => {
                              sessionStorage.setItem('highlightRoute', String(r.id));
                              openEdit(r);
                            }}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            className="btn-danger py-1.5 px-2"
                            title="Delete"
                            onClick={() => {
                              sessionStorage.setItem('highlightRoute', String(r.id));
                              setDeleteItem(r);
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
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
          totalCount={count || routes?.length || 0}
          pageSize={ADMIN_PAGE_SIZE}
          onPageChange={(p) => {
            setSearchParams((prev) => {
              const nextParams = new URLSearchParams(prev);
              nextParams.set('page', String(p));
              return nextParams;
            });
          }}
          entityLabel="routes"
        />
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="admin-modal-overlay" onClick={closeForm}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2 className="admin-modal-title">
                {editId ? 'Edit Flight Route' : 'Add Flight Route'}
              </h2>
              <button className="btn-icon" onClick={closeForm}><X size={16} /></button>
            </div>

            {validationErrors && (
              <div className="admin-error">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <div className="flex flex-col gap-1">
                  {typeof validationErrors === 'string' ? (
                    <span>{validationErrors}</span>
                  ) : (
                    Object.entries(validationErrors).map(([key, val]) => {
                      const msg = Array.isArray(val) ? val.join(', ') : String(val);
                      return (
                        <div key={key}>
                          <strong className="capitalize">{key.replace('_', ' ')}:</strong> {msg}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {/* Row 1: Airline + Flight Number */}
              <div className="admin-form-grid mb-4">
                <Select id="airline" label="Airline" options={airlineOptions} value={form.airline}
                  onChange={(e) => {
                    const airlineId = e.target.value;
                    setForm((f) => ({
                      ...f,
                      airline: airlineId,
                      flight_no: '',
                    }));
                  }}
                  error={localErrors.airline} />
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="flight_no" className="text-[11px] font-bold tracking-[0.06em] uppercase text-[#5e5e5e]">
                    Flight Number
                  </label>
                  <div className="flex items-center">
                    {form.airline ? (() => {
                      const selected = airlines.find((a) => String(a.id) === String(form.airline));
                      if (selected) {
                        return (
                          <div className={`py-[9px] px-3.5 bg-black/[0.04] border-[1.5px] border-r-0 rounded-l-[10px] text-sm font-bold text-[#5e5e5e] font-sans h-10 flex items-center box-border whitespace-nowrap shrink-0 ${(localErrors.flight_no || validationErrors?.flight_no)
                              ? 'border-[#b91c1c]'
                              : (isFlightNoFocused ? 'border-[#888888]' : 'border-black/10')
                            }`}>
                            {selected.iata_airline_code} -
                          </div>
                        );
                      }
                      return null;
                    })() : null}
                    <input
                      id="flight_no"
                      placeholder={form.airline ? "e.g. 202" : "Select airline first..."}
                      value={form.flight_no}
                      disabled={!!editId || !form.airline}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, ''); // only allow digits
                        setForm((f) => ({ ...f, flight_no: val }));
                      }}
                      onFocus={() => setIsFlightNoFocused(true)}
                      onBlur={() => setIsFlightNoFocused(false)}
                      className={`flex-1 border-[1.5px] py-[9px] px-[13px] text-sm font-medium text-[#1a1c1d] font-sans outline-none h-10 box-border transition-all duration-200 ${form.airline ? 'border-l-0 rounded-r-[10px]' : 'rounded-[10px]'
                        } ${form.airline
                          ? (isFlightNoFocused ? 'bg-white/90' : 'bg-white/65')
                          : 'bg-black/[0.03]'
                        } ${(localErrors.flight_no || validationErrors?.flight_no)
                          ? (isFlightNoFocused ? 'border-[#b91c1c] shadow-[0_0_0_3px_rgba(185,28,28,0.18)]' : 'border-[#b91c1c] shadow-[0_0_0_3px_rgba(185,28,28,0.1)]')
                          : (isFlightNoFocused ? 'border-[#888888] shadow-[0_0_0_3px_rgba(0,0,0,0.05)]' : 'border-black/10 shadow-none')
                        }`}
                    />
                  </div>
                  {(localErrors.flight_no || validationErrors?.flight_no) && (
                    <p className="text-xs text-[#b91c1c] mt-0.5 pl-0.5">
                      {localErrors.flight_no || (Array.isArray(validationErrors.flight_no) ? validationErrors.flight_no.join(', ') : validationErrors.flight_no)}
                    </p>
                  )}
                </div>
              </div>

              {/* Row 2: Days selection */}
              <div className="flex flex-col gap-1.5 mb-4">
                <label className="text-[11px] font-bold tracking-[0.06em] uppercase text-[#5e5e5e] flex items-center gap-1">
                  <Calendar size={13} /> Operating Days
                </label>
                <div className="flex flex-wrap gap-1.5 items-center">
                  {DAYS_OF_WEEK.map((d) => {
                    const selected = form.operates_on_days?.split(',').map((s) => s.trim()).includes(d.id);
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => {
                          const current = form.operates_on_days ? form.operates_on_days.split(',').map((s) => s.trim()).filter(Boolean) : [];
                          let next;
                          if (selected) {
                            next = current.filter((x) => x !== d.id);
                          } else {
                            next = [...current, d.id].sort((a, b) => Number(a) - Number(b));
                          }
                          setForm((f) => ({ ...f, operates_on_days: next.join(',') }));
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${selected
                            ? 'shadow-sm bg-[rgba(112,93,0,0.06)] border-[rgba(112,93,0,0.25)] text-[#705d00]'
                            : 'bg-white text-slate-400 border-slate-200 hover:border-slate-400 hover:text-slate-600'
                          }`}
                      >
                        {d.short}
                      </button>
                    );
                  })}
                  <div className="flex gap-1 ml-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, operates_on_days: '1,2,3,4,5,6,7' }))}
                      className="text-slate-600 hover:underline bg-transparent border-none p-0 cursor-pointer font-medium"
                    >
                      All
                    </button>
                    <span className="text-slate-400">|</span>
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, operates_on_days: '1,2,3,4,5' }))}
                      className="text-slate-600 hover:underline bg-transparent border-none p-0 cursor-pointer font-medium"
                    >
                      Weekdays
                    </button>
                    <span className="text-slate-400">|</span>
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, operates_on_days: '6,7' }))}
                      className="text-slate-600 hover:underline bg-transparent border-none p-0 cursor-pointer font-medium"
                    >
                      Weekends
                    </button>
                  </div>
                </div>
                {localErrors.operates_on_days && (
                  <p className="text-xs text-[#b91c1c] mt-1">{localErrors.operates_on_days}</p>
                )}
              </div>

              {/* Row 3: Extra Baggage Add-on Configuration */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-5 items-start">
                <div>
                  <Input id="max_extra_baggage" label="Max Extra Baggage (kg)" type="number"
                    value={form.max_extra_baggage_kg_per_person}
                    onChange={(e) => setForm((f) => ({ ...f, max_extra_baggage_kg_per_person: e.target.value }))}
                    error={localErrors.max_extra_baggage_kg_per_person} />
                  <span className="text-[11px] text-slate-500 block mt-1">
                    Maximum add-on baggage a passenger can buy.
                  </span>
                </div>
                <div>
                  <Input id="extra_baggage_price" label="Price per extra kg" type="number" step="0.01"
                    value={form.extra_baggage_price_per_kg}
                    onChange={(e) => setForm((f) => ({ ...f, extra_baggage_price_per_kg: e.target.value }))}
                    error={localErrors.extra_baggage_price_per_kg} />
                  <span className="text-[11px] text-slate-500 block mt-1">
                    Amount to charge for each additional kg.
                  </span>
                </div>
                <div>
                  <Input id="extra_baggage_currency" label="Currency"
                    value={form.extra_baggage_currency}
                    onChange={(e) => setForm((f) => ({ ...f, extra_baggage_currency: e.target.value }))} />
                  <span className="text-[11px] text-slate-500 block mt-1">
                    Currency code (e.g., INR, USD).
                  </span>
                </div>
              </div>

              {/* Live Route Schedule Overview Card */}
              {(() => {
                const firstLeg = form.legs[0];
                const lastLeg = form.legs[form.legs.length - 1];
                const originAirport = airports.find((a) => String(a.id) === String(firstLeg?.departure_airport));
                const destAirport = airports.find((a) => String(a.id) === String(lastLeg?.arrival_airport));
                const totalFlightMins = form.legs.reduce((acc, l) => acc + (Number(l.flight_duration_minutes) || 0), 0);
                const totalLayoverMins = form.legs.slice(1).reduce((acc, l) => acc + (Number(l.layover_duration_minutes) || 0), 0);
                const totalTripMins = totalFlightMins + totalLayoverMins;
                const stopsCount = Math.max(0, form.legs.length - 1);

                return (
                  <div className="mb-5 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs bg-[rgba(112,93,0,0.04)] border border-[rgba(112,93,0,0.12)]">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-200/70 flex items-center justify-center text-slate-600 shrink-0 border border-slate-200/60">
                        <Clock size={20} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Overall Route Schedule</span>
                          <span className="text-[10px] bg-slate-200/80 text-slate-700 font-semibold px-2 py-0.5 rounded-full">
                            {stopsCount === 0 ? 'Non-stop' : `${stopsCount} Stop${stopsCount > 1 ? 's' : ''}`}
                          </span>
                        </div>
                        <div className="text-sm font-bold text-slate-900 flex items-center gap-1.5 mt-0.5">
                          <span>{formatTime12h(form.scheduled_departure_time || firstLeg?.scheduled_departure_time)}</span>
                          <span className="text-slate-400 font-normal">→</span>
                          <span>{formatTime12h(form.scheduled_arrival_time || lastLeg?.scheduled_arrival_time)}</span>
                          <span className="text-xs font-normal text-slate-500 ml-1">
                            ({formatMins(totalTripMins)} total)
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs font-medium text-slate-600 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-xs shrink-0">
                      <span className="font-bold text-slate-800">{originAirport?.iata_code || 'DEP'}</span>
                      <span className="text-slate-400">✈</span>
                      <span className="font-bold text-slate-800">{destAirport?.iata_code || 'ARR'}</span>

                    </div>
                  </div>
                );
              })()}

              {/* Legs */}
              <div className="mb-5">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="m-0 text-[13px] font-bold uppercase tracking-[.06em] text-slate-600 flex items-center gap-1.5">
                    <MapPin size={14} /> Flight Legs
                  </h3>
                  <button type="button" className="btn-secondary text-xs py-1 px-2.5" onClick={addLeg}>
                    <PlusCircle size={13} /> Add Leg
                  </button>
                </div>
                {localErrors.legs && <p className="text-xs text-[#b91c1c] mb-2">{localErrors.legs}</p>}

                {form.legs.map((leg, i) => (
                  <div key={i} className="leg-row mb-3">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Leg {i + 1}</span>
                      {form.legs.length > 1 && (
                        <button type="button" onClick={() => removeLeg(i)} className="bg-transparent border-none cursor-pointer text-[#b91c1c] p-0">
                          <MinusCircle size={16} />
                        </button>
                      )}
                    </div>
                    {/* Airports row: DEP ──▶ ARR */}
                    <div className="leg-airports-row">
                      <Select id={`dep_apt_${i}`} label={i > 0 ? `Departure Airport (from Leg ${i})` : "Departure Airport"} options={airportOptions}
                        value={leg.departure_airport}
                        disabled={i > 0}
                        onChange={(e) => updateLeg(i, 'departure_airport', e.target.value)}
                        error={localErrors[`leg_${i}_dep_apt`]} />
                      <div className="leg-arrow-container select-none">
                        <div className="h-[21px]" />
                        <div className="leg-arrow">→</div>
                      </div>
                      <Select id={`arr_apt_${i}`} label="Arrival Airport" options={airportOptions}
                        value={leg.arrival_airport}
                        onChange={(e) => updateLeg(i, 'arrival_airport', e.target.value)}
                        error={localErrors[`leg_${i}_arr_apt`]} />
                    </div>

                    {/* Schedule times — 2 columns + full-width duration bar */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mt-3">
                      <div>
                        <TimePicker
                          id={`leg_dep_time_${i}`}
                          label="Leg Departure Time"
                          value={leg.scheduled_departure_time || ''}
                          onChange={(e) => updateLeg(i, 'scheduled_departure_time', e.target.value)}
                          error={localErrors[`leg_${i}_dep_time`]}
                        />
                        <span className="text-[11px] text-slate-500 block mt-1">
                          {formatTime12h(leg.scheduled_departure_time)}
                        </span>
                      </div>

                      <div>
                        <TimePicker
                          id={`leg_arr_time_${i}`}
                          label={i === form.legs.length - 1 ? "Final Arrival Time" : "Leg Arrival Time"}
                          value={leg.scheduled_arrival_time || ''}
                          onChange={(e) => updateLeg(i, 'scheduled_arrival_time', e.target.value)}
                          error={localErrors[`leg_${i}_arr_time`]}
                        />
                        <span className="text-[11px] text-slate-500 block mt-1">
                          {formatTime12h(leg.scheduled_arrival_time)}
                        </span>
                      </div>

                      {/* Flight duration bar — spans both columns */}
                      <div className="col-span-full flex items-center gap-3 py-1">
                        <div className="flex-1 h-px bg-slate-200" />
                        <div className={`flex items-center gap-1.5 text-[12px] tracking-wide select-none ${localErrors[`leg_${i}_duration`] ? 'text-red-600' : 'text-slate-500'
                          }`}>
                          <Clock size={13} className={localErrors[`leg_${i}_duration`] ? 'text-red-500' : 'text-slate-400'} />
                          <span className={`font-bold text-[13px] ${localErrors[`leg_${i}_duration`] ? 'text-red-600' : 'text-slate-700'}`}>
                            {formatMins(Number(leg.flight_duration_minutes) || 0)}
                          </span>
                          <span className="font-normal text-[11px]">
                            {leg.flight_duration_minutes || 0} mins
                          </span>
                        </div>
                        <div className="flex-1 h-px bg-slate-200" />
                        {localErrors[`leg_${i}_duration`] && (
                          <span className="text-[10px] text-red-600 font-medium whitespace-nowrap">
                            {localErrors[`leg_${i}_duration`]}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Layover row for multi-leg routes */}
                    {i > 0 && (
                      <div className="mt-3 max-w-[280px]">
                        <Input
                          id={`layover_${i}`}
                          label="Layover Before This Leg (mins)"
                          type="number"
                          placeholder="e.g. 60"
                          value={leg.layover_duration_minutes}
                          onChange={(e) => updateLeg(i, 'layover_duration_minutes', e.target.value)}
                          error={localErrors[`leg_${i}_layover`]}
                        />
                        <span className="text-[11px] text-slate-500 block mt-1">
                          Layover: {formatMins(Number(leg.layover_duration_minutes) || 0)}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-6 border-t border-slate-200 mt-8">
                <button type="button" className="btn-secondary" onClick={closeForm}><X size={14} /> Cancel</button>

                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" className="btn-secondary" disabled={actionLoading} onClick={(e) => handleSubmit(e, false)}>
                    <Save size={14} /> {actionLoading ? 'Saving…' : 'Save'}
                  </button>

                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={(e) => handleSubmit(e, true)}
                    className="px-4 py-2 rounded-xl bg-[#705d00] hover:bg-[#5a4b00] text-white font-bold text-xs flex items-center gap-1.5 shadow-md cursor-pointer transition-all border-none"
                  >
                    Save & Next <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      <DeleteConfirmationModal
        isOpen={deleteItem !== null}
        loading={deleteLoading}
        title="Delete Flight Route"
        message="Are you sure you want to delete this flight route?"
        details={deleteItem ? { 'FLIGHT NO': deleteItem.flight_no, AIRLINE: deleteItem.airline_name, ID: deleteItem.id } : null}
        onClose={() => setDeleteItem(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}