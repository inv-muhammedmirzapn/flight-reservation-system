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
  { key: 'timezone', label: 'Timezone' },
];

const EMPTY_FORM = {
  iata_code: '', airport_name: '', city: '', timezone: 'UTC',
  latitude: '', longitude: '', country: '',
};

const validateForm = (form) => {
  const e = {};
  if (!form.iata_code || form.iata_code.length !== 3) e.iata_code = 'IATA code must be exactly 3 characters.';
  if (!form.airport_name) e.airport_name = 'Airport name is required.';
  if (!form.city) e.city = 'City is required.';
  if (!form.country) e.country = 'Country is required.';
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
