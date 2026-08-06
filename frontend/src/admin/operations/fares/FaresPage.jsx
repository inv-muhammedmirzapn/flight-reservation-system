/**
 * FaresPage — per-flight-instance fares. available_seats is read-only/derived.
 */
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useSearchParams, useNavigate } from 'react-router-dom';
import AdminCrudPage from '@/admin/_core/AdminCrudPage';
import { fetchFlightInstances, fetchFares, fetchFareDetail, addFare, updateFare, removeFare } from '@/admin/_core/store/adminSlices';
import { ChevronRight, Armchair, Utensils, CheckCircle2 } from 'lucide-react';

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
  { key: 'fare_code', label: 'Fare Code' },
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
  if (form.price === '' || Number(form.price) < 0) e.price = 'Price must be a non-negative number.';
  if (form.change_fee === '' || Number(form.change_fee) < 0) e.change_fee = 'Change fee must be a non-negative number.';
  if (form.baggage_allowance !== '' && Number(form.baggage_allowance) < 0) e.baggage_allowance = 'Baggage cannot be negative.';
  return e;
};

const THUNKS = { fetchList: fetchFares, fetchDetail: fetchFareDetail, add: addFare, update: updateFare, remove: removeFare };

export default function FaresPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const instanceParam = searchParams.get('instance');

  const { items: instances } = useSelector((s) => s.flightInstance);
  useEffect(() => { dispatch(fetchFlightInstances({ page_size: 500 })); }, [dispatch]);

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

  const modifiedThunks = {
    ...THUNKS,
    fetchList: (params) => fetchFares({ ...params, flight_instance: instanceParam || '' }),
  };

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

  return (
    <>
      <AdminCrudPage
        title="Fares"
        breadcrumb={breadcrumb}
        entityName="fare"
        columns={COLUMNS}
        fields={FIELDS}
        emptyForm={initialForm}
        validateForm={validateForm}
        thunks={modifiedThunks}
        banner={flowBanner}
        saveAndNextUrl={instanceParam && inFlow ? `/admin/operations/seat-map?instance=${instanceParam}&inFlow=1${fromPage ? `&fromPage=${fromPage}` : ''}` : null}
      />
    </>
  );
}
