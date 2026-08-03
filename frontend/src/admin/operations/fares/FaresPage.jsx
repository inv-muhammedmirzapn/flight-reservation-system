/**
 * FaresPage — per-flight-instance fares. available_seats is read-only/derived.
 */
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useSearchParams } from 'react-router-dom';
import AdminCrudPage from '@/admin/_core/AdminCrudPage';
import { fetchFlightInstances, fetchFares, fetchFareDetail, addFare, updateFare, removeFare } from '@/admin/_core/store/adminSlices';

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
    // available_seats is intentionally excluded from FIELDS — it's read-only/derived
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

  return (
    <AdminCrudPage
      title="Fares"
      breadcrumb={breadcrumb}
      entityName="fare"
      columns={COLUMNS}
      fields={FIELDS}
      emptyForm={initialForm}
      validateForm={validateForm}
      thunks={modifiedThunks}
    />
  );
}
