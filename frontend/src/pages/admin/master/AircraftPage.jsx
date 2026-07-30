import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import AdminCrudPage from '../AdminCrudPage';
import { fetchAirlines, fetchAircraftModels } from '@/store/adminSlices';
import {
  fetchAircraft, fetchAircraftDetail, addAircraft, updateAircraft, removeAircraft,
} from '@/store/adminSlices';

const COLUMNS = [
  { key: 'registration', label: 'Registration' },
  { key: 'airline_name', label: 'Airline' },
  { key: 'model_display', label: 'Model' },
  { key: 'economy_capacity', label: 'Economy' },
  { key: 'business_capacity', label: 'Business' },
  { key: 'first_class_capacity', label: 'First' },
];

const EMPTY_FORM = {
  registration: '', airline: '', aircraft_model: '',
  economy_capacity: '', business_capacity: '', first_class_capacity: '',
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
    { name: 'business_capacity', label: 'Business Capacity', type: 'number', placeholder: '0' },
    { name: 'first_class_capacity', label: 'First Class Capacity', type: 'number', placeholder: '0' },
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
