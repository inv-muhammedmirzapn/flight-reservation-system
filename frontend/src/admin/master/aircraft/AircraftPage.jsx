import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import AdminCrudPage from '@/admin/_core/AdminCrudPage';
import { fetchAirlines, fetchAircraftModels } from '@/admin/_core/store/adminSlices';
import {
  fetchAircraft, fetchAircraftDetail, addAircraft, updateAircraft, removeAircraft,
} from '@/admin/_core/store/adminSlices';

const COLUMNS = [
  { key: 'registration', label: 'Registration' },
  { key: 'airline_name', label: 'Airline' },
  { key: 'model_display', label: 'Model' },
  { key: 'economy_capacity', label: 'Economy', className: 'text-center !px-2' },
  {
    key: 'economy_layout',
    label: 'Layout',
    className: 'text-center !px-2',
    render: (item) => (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono font-medium bg-[#f3f4f6] text-[#374151]">
        {item.economy_layout || '—'}
      </span>
    ),
  },
  { key: 'business_capacity', label: 'Business', className: 'text-center !px-2' },
  {
    key: 'business_layout',
    label: 'Layout',
    className: 'text-center !px-2',
    render: (item) => (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono font-medium bg-[#f3f4f6] text-[#374151]">
        {item.business_layout || '—'}
      </span>
    ),
  },
  { key: 'first_class_capacity', label: 'First', className: 'text-center !px-2' },
  {
    key: 'first_class_layout',
    label: 'Layout',
    className: 'text-center !px-2',
    render: (item) => (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono font-medium bg-[#f3f4f6] text-[#374151]">
        {item.first_class_layout || '—'}
      </span>
    ),
  },
];

const EMPTY_FORM = {
  registration: '', airline: '', aircraft_model: '',
  economy_capacity: '', business_capacity: '', first_class_capacity: '',
  economy_layout: '3-3', business_layout: '2-2', first_class_layout: '2-2',
};

const validateForm = (form) => {
  const e = {};
  if (!form.registration || !/^[A-Za-z0-9-]+$/.test(form.registration.trim())) e.registration = 'Registration must be alphanumeric with hyphens.';
  if (!form.airline) e.airline = 'Airline is required.';
  if (!form.aircraft_model) e.aircraft_model = 'Aircraft model is required.';

  const isInt = (val) => val !== '' && Number.isInteger(Number(val)) && Number(val) >= 0;
  if (!isInt(form.economy_capacity)) e.economy_capacity = 'Must be a non-negative integer.';
  if (!isInt(form.business_capacity)) e.business_capacity = 'Must be a non-negative integer.';
  if (!isInt(form.first_class_capacity)) e.first_class_capacity = 'Must be a non-negative integer.';

  const layoutRegex = /^\d+(-\d+)*$/;
  if (form.economy_layout && !layoutRegex.test(form.economy_layout)) e.economy_layout = 'Layout must be numbers separated by hyphens (e.g. 3-3).';
  if (form.business_layout && !layoutRegex.test(form.business_layout)) e.business_layout = 'Layout must be numbers separated by hyphens (e.g. 2-2).';
  if (form.first_class_layout && !layoutRegex.test(form.first_class_layout)) e.first_class_layout = 'Layout must be numbers separated by hyphens (e.g. 2-2).';
  return e;
};

const THUNKS = { fetchList: fetchAircraft, fetchDetail: fetchAircraftDetail, add: addAircraft, update: updateAircraft, remove: removeAircraft };

export default function AircraftPage() {
  const dispatch = useDispatch();
  const { items: airlines } = useSelector((s) => s.airline);
  const { items: models } = useSelector((s) => s.aircraftModel);

  useEffect(() => {
    dispatch(fetchAirlines({}));
    dispatch(fetchAircraftModels({}));
  }, [dispatch]);

  const airlineOptions = airlines.map((a) => ({ value: a.id, label: `${a.iata_airline_code} – ${a.airline_name}` }));
  const modelOptions = models.map((m) => ({ value: m.id, label: `${m.manufacturer} ${m.model_name}` }));

  const FIELDS = [
    { name: 'registration', label: 'Registration', placeholder: 'e.g. VT-ANB' },
    { name: 'airline', label: 'Airline', type: 'select', options: airlineOptions },
    { name: 'aircraft_model', label: 'Aircraft Model', type: 'select', options: modelOptions },
    { name: 'economy_capacity', label: 'Economy Capacity', type: 'number', placeholder: '0' },
    { name: 'economy_layout', label: 'Economy Layout', placeholder: 'e.g. 3-3' },
    { name: 'business_capacity', label: 'Business Capacity', type: 'number', placeholder: '0' },
    { name: 'business_layout', label: 'Business Layout', placeholder: 'e.g. 2-2' },
    { name: 'first_class_capacity', label: 'First Class Capacity', type: 'number', placeholder: '0' },
    { name: 'first_class_layout', label: 'First Class Layout', placeholder: 'e.g. 2-2' },
  ];

  return (
    <AdminCrudPage
      title="Aircraft"
      entityName="aircraft"
      columns={COLUMNS}
      fields={FIELDS}
      emptyForm={EMPTY_FORM}
      validateForm={validateForm}
      thunks={THUNKS}
    />
  );
}
