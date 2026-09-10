/**
 * FaresPage — per-flight-instance fares. available_seats is read-only/derived.
 */
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useSearchParams, useNavigate } from 'react-router-dom';
import AdminCrudPage from '@/admin/_core/AdminCrudPage';
import { fetchFlightInstances, fetchFares, fetchFareDetail, addFare, updateFare, removeFare } from '@/admin/_core/store/adminSlices';
import { ChevronRight, Armchair, Utensils } from 'lucide-react';
import DatePicker from '@/components/ui/DatePicker';

const CABIN_OPTIONS = [
  { value: 'ECONOMY', label: 'Economy' },
  { value: 'BUSINESS', label: 'Business' },
  { value: 'FIRST', label: 'First' },
];
const REFUND_OPTIONS = [
  { value: 'REFUNDABLE', label: 'Refundable' },
  { value: 'NON_REFUNDABLE', label: 'Non-Refundable' },
  { value: 'PARTIAL', label: 'Partial' },
];

const COLUMNS = [
  { key: 'flight_no', label: 'Flight No.' },
  { key: 'instance_date', label: 'Date' },
  { key: 'cabin_class', label: 'Cabin' },
  { key: 'price', label: 'Price', render: (r) => `${r.currency} ${r.price}` },
  { key: 'available_seats', label: 'Avail. Seats (derived)' },
  { key: 'refund_type', label: 'Refund Type' },
  { key: 'meal_included', label: 'Meal', render: (r) => r.meal_included ? '✓' : '—' },
];

const EMPTY_FORM = {
  flight_instance: '', fare_code: '', cabin_class: 'ECONOMY',
  price: '', currency: 'INR', refund_type: 'NON_REFUNDABLE',
  change_fee: '0', meal_included: false, baggage_allowance: '',
};

const validateForm = (form) => {
  const e = {};
  if (!form.flight_instance) e.flight_instance = 'Flight instance is required.';
  if (!form.fare_code || form.fare_code.trim().length < 2) e.fare_code = 'Fare code must be at least 2 characters.';
  if (!form.cabin_class) e.cabin_class = 'Cabin class is required.';
  if (form.price === '' || isNaN(Number(form.price)) || Number(form.price) <= 0) {
    e.price = 'Price must be greater than 0.';
  }
  if (form.change_fee === '' || isNaN(Number(form.change_fee)) || Number(form.change_fee) < 0) {
    e.change_fee = 'Change fee must be a non-negative number.';
  }
  if (form.baggage_allowance !== '' && (isNaN(Number(form.baggage_allowance)) || Number(form.baggage_allowance) < 0)) {
    e.baggage_allowance = 'Baggage cannot be negative.';
  }
  if (!form.currency || !/^[A-Za-z]{3}$/.test(form.currency.trim())) {
    e.currency = 'Currency must be a 3-letter code (e.g. INR).';
  }
  return e;
};

const THUNKS = { fetchList: fetchFares, fetchDetail: fetchFareDetail, add: addFare, update: updateFare, remove: removeFare };

export default function FaresPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const instanceParam = searchParams.get('instance');

  // Date filter state (used when NOT in instance-param mode)
  const [dateFilter, setDateFilter] = useState('');

  const { items: instances } = useSelector((s) => s.flightInstance);
  useEffect(() => {
    if (!instances || instances.length === 0) {
      dispatch(fetchFlightInstances({ page_size: 500 }));
    }
  }, [dispatch, instances.length]);

  const instanceOptions = instances.map((i) => ({
    value: i.id,
    label: `${i.flight_no} — ${i.date}`,
  }));

  const FIELDS = [
    { name: 'flight_instance', label: 'Flight Instance', type: 'select', options: instanceOptions },
    { name: 'fare_code', label: 'Fare Code', placeholder: 'e.g. ECO-FLEX' },
    { name: 'cabin_class', label: 'Cabin Class', type: 'select', options: CABIN_OPTIONS },
    { name: 'price', label: 'Price', type: 'number', placeholder: '0' },
    { name: 'currency', label: 'Currency', placeholder: 'INR' },
    { name: 'refund_type', label: 'Refund Type', type: 'select', options: REFUND_OPTIONS },
    { name: 'change_fee', label: 'Change Fee', type: 'number', placeholder: '0' },
    { name: 'meal_included', label: 'Meal Included', type: 'checkbox' },
    { name: 'baggage_allowance', label: 'Baggage Override (kg, optional)', type: 'number', placeholder: 'Leave blank to use flight default' },
  ];

  const breadcrumb = instanceParam ? [
    { label: 'Flight Instances', href: '/admin/operations/flight-instances' },
    { label: `Fares (Instance #${instanceParam})` }
  ] : null;

  const initialForm = { ...EMPTY_FORM, flight_instance: instanceParam || '' };

  // Build the fetchList thunk — pass flight_instance if in instance mode, or date filter otherwise
  const buildFetchList = useCallback((params) => {
    const extra = {};
    if (instanceParam) {
      extra.flight_instance = instanceParam;
    }
    if (dateFilter) {
      extra.date = dateFilter;
    }
    return fetchFares({ ...params, ...extra });
  }, [instanceParam, dateFilter]);

  const modifiedThunks = useMemo(() => ({
    ...THUNKS,
    fetchList: buildFetchList,
  }), [buildFetchList]);

  const fromPage = searchParams.get('fromPage');
  const inFlow = searchParams.get('inFlow') === '1';

  const flowBanner = instanceParam && inFlow ? (
    <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 rounded-2xl p-4 mb-6 flex flex-wrap items-center justify-between gap-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-[#705d00] text-white flex items-center justify-center font-black text-xs shadow">
          2/4
        </div>
        <div>
          <div className="text-xs font-extrabold uppercase tracking-wider text-[#705d00]">
            Instance Setup Flow • Step 2 (Fares)
          </div>
          <div className="text-sm font-bold text-slate-800">
            Adding Fares for Flight Instance #{instanceParam}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => navigate(`/admin/operations/seat-map?instance=${instanceParam}&inFlow=1${fromPage ? `&fromPage=${fromPage}` : ''}`)}
          className="px-3.5 py-2 rounded-xl bg-[#705d00] hover:bg-[#5a4b00] text-white font-bold text-xs flex items-center gap-1.5 shadow-md cursor-pointer transition-all border-none"
        >
          <Armchair size={14} /> Skip / Next: Seats <ChevronRight size={14} />
        </button>
        <button
          type="button"
          onClick={() => navigate(`/admin/operations/meals?instance=${instanceParam}&inFlow=1${fromPage ? `&fromPage=${fromPage}` : ''}`)}
          className="px-3 py-2 rounded-xl bg-white hover:bg-amber-50 text-[#705d00] font-bold text-xs flex items-center gap-1 cursor-pointer transition-all border border-[#705d00]/40"
        >
          <Utensils size={14} /> Skip to Meals <ChevronRight size={14} />
        </button>
        <button
          type="button"
          onClick={() => {
            if (fromPage) {
              navigate(`/admin/operations/flight-instances?page=${fromPage}&highlightInstance=${instanceParam}`);
            } else {
              navigate('/admin/operations/flight-instances');
            }
          }}
          className="px-3 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-600 font-semibold text-xs transition-all border border-slate-200 cursor-pointer"
        >
          Finish Flow
        </button>
      </div>
    </div>
  ) : null;

  const templateNoticeBanner = (
    <div style={{ background: 'rgba(112,93,0,0.06)', border: '1px solid rgba(112,93,0,0.18)', borderRadius: 16, padding: '14px 16px', marginBottom: 24, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16, fontSize: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--color-admin-accent-dark)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0, fontSize: 14 }}>
          ℹ
        </div>
        <div>
          <div style={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-admin-accent-dark)', fontSize: 11, marginBottom: 2 }}>
            Template-Driven Pricing Enabled
          </div>
          <div style={{ color: 'var(--color-admin-ink)', lineHeight: 1.5 }}>
            Instance fares are auto-generated from <strong>Route Fare Templates</strong>. To change base prices across all future flight dates atomically, use the Route Fare Templates manager.
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={() => navigate('/admin/operations/route-fare-classes')}
        className="btn-primary"
        style={{ fontSize: 12, padding: '7px 14px', whiteSpace: 'nowrap' }}
      >
        Manage Route Fare Templates
      </button>
    </div>
  );

  const combinedBanner = (
    <>
      {templateNoticeBanner}
      {flowBanner}
    </>
  );

  /* ── Date filter bar (Today / Tomorrow / DatePicker) ── */
  const today = new Date();
  const fmt = (d) => d.toISOString().slice(0, 10);
  const todayStr = fmt(today);
  const tomorrowStr = fmt(new Date(today.getTime() + 86400000));

  const dateChips = [
    { label: 'Today', date: todayStr },
    { label: 'Tomorrow', date: tomorrowStr },
  ];

  const dateFilterBar = !instanceParam ? (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      {/* Divider */}
      <div style={{ width: 1, height: 28, background: 'rgba(0,0,0,0.08)', flexShrink: 0 }} />

      {/* Quick Date Chips */}
      {dateChips.map(chip => {
        const isActive = dateFilter === chip.date;
        return (
          <button
            key={chip.label}
            type="button"
            onClick={() => {
              if (isActive) {
                setDateFilter('');
              } else {
                setDateFilter(chip.date);
              }
            }}
            style={{
              padding: '6px 13px',
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'all 0.18s',
              border: isActive ? '1.5px solid #705d00' : '1.5px solid rgba(0,0,0,0.1)',
              background: isActive ? '#705d00' : 'rgba(255,255,255,0.7)',
              color: isActive ? '#fff' : '#5e5e5e',
              boxShadow: isActive ? '0 2px 8px rgba(112,93,0,0.18)' : 'none',
            }}
          >
            {chip.label}
          </button>
        );
      })}

      {/* Inline Date Picker */}
      <div style={{ flexShrink: 0, width: 136 }}>
        <DatePicker
          placeholder="Pick date"
          value={dateFilter}
          onChange={(val) => setDateFilter(val)}
        />
      </div>
    </div>
  ) : null;

  const CONFIG = {
    title: 'Fares (Instance Level)',
    breadcrumb,
    entityName: 'fare',
    hideSearch: !!instanceParam,
    columns: COLUMNS,
    fields: FIELDS,
    emptyForm: initialForm,
    validateForm,
    thunks: modifiedThunks,
    getDeleteDetails: (item) => {
      if (!item) return null;
      const details = {};
      if (item.flight_no) {
        details['FLIGHT NO.'] = item.flight_no;
      }
      if (item.fare_code) {
        details['FARE CODE'] = item.fare_code;
      }
      if (item.cabin_class) details['CABIN CLASS'] = item.cabin_class;
      if (item.price !== undefined && item.price !== null) details['PRICE'] = `${item.currency || 'INR'} ${item.price}`;
      return details;
    }
  };

  return (
    <>
      <AdminCrudPage
        config={CONFIG}
        banner={combinedBanner}
        filterBar={dateFilterBar}
        saveAndNextUrl={instanceParam && inFlow ? `/admin/operations/seat-map?instance=${instanceParam}&inFlow=1${fromPage ? `&fromPage=${fromPage}` : ''}` : null}
      />
    </>
  );
}
