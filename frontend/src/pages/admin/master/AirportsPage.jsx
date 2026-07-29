import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import AdminCrudPage from '../AdminCrudPage';
import { fetchCountries } from '@/store/adminSlices';
import {
  fetchAirports, fetchAirportDetail, addAirport, updateAirport, removeAirport,
} from '@/store/adminSlices';

const COLUMNS = [
  { key: 'iata_code', label: 'IATA Code' },
  { key: 'airport_name', label: 'Airport Name' },
  { key: 'city', label: 'City' },
  { key: 'country_name', label: 'Country' },
  { key: 'terminals', label: 'Terminals', render: (r) => (r.terminals && r.terminals.length > 0 ? `${r.terminals.length} Terminal${r.terminals.length > 1 ? 's' : ''}` : '—') },
];

const EMPTY_FORM = {
  iata_code: '', airport_name: '', city: '', timezone: 'UTC',
  latitude: '', longitude: '', country: '', terminals: [],
};

const validateForm = (form) => {
  const e = {};
  if (!form.iata_code || !/^[A-Za-z]{3}$/.test(form.iata_code.trim())) e.iata_code = 'IATA code must be exactly 3 alphabetic characters.';
  if (!form.airport_name || form.airport_name.trim().length < 3) e.airport_name = 'Airport name must be at least 3 characters.';
  if (!form.city || form.city.trim().length < 2) e.city = 'City name must be at least 2 characters.';
  if (!form.country) e.country = 'Country is required.';
  if (form.latitude !== '' && (Number(form.latitude) < -90 || Number(form.latitude) > 90)) e.latitude = 'Must be between -90 and 90.';
  if (form.longitude !== '' && (Number(form.longitude) < -180 || Number(form.longitude) > 180)) e.longitude = 'Must be between -180 and 180.';
  return e;
};

const THUNKS = { fetchList: fetchAirports, fetchDetail: fetchAirportDetail, add: addAirport, update: updateAirport, remove: removeAirport };

export default function AirportsPage() {
  const dispatch = useDispatch();
  const { items: countries } = useSelector((s) => s.country);

  useEffect(() => { dispatch(fetchCountries({})); }, [dispatch]);

  const countryOptions = countries.map((c) => ({ value: c.id, label: `${c.name} (${c.iso_code})` }));

  const FIELDS = [
    { name: 'iata_code', label: 'IATA Code (3 chars)', placeholder: 'e.g. JFK', autoUpper: true },
    { name: 'airport_name', label: 'Airport Name', placeholder: 'e.g. John F. Kennedy International' },
    { name: 'city', label: 'City', placeholder: 'e.g. New York' },
    { name: 'country', label: 'Country', type: 'select', options: countryOptions },
    { name: 'timezone', label: 'Timezone', placeholder: 'e.g. America/New_York' },
    { name: 'latitude', label: 'Latitude', type: 'number', placeholder: 'e.g. 40.6413' },
    { name: 'longitude', label: 'Longitude', type: 'number', placeholder: 'e.g. -73.7781' },
    { name: 'terminals', label: 'Terminals', type: 'string-array', placeholder: 'e.g. T1' },
  ];

  return (
    <AdminCrudPage
      title="Airports"
      entityName="airport"
      columns={COLUMNS}
      fields={FIELDS}
      emptyForm={EMPTY_FORM}
      validateForm={validateForm}
      thunks={THUNKS}
    />
  );
}
