import { useEffect, useState, useCallback } from 'react';
import AdminCrudPage from '@/admin/_core/AdminCrudPage';
import { fetchWithAuth } from '@/services/apiClient';
import {
  fetchAirports, fetchAirportDetail, addAirport, updateAirport, removeAirport,
} from '@/admin/_core/store/adminSlices';

const COLUMNS = [
  { key: 'iata_code', label: 'IATA Code' },
  { key: 'airport_name', label: 'Airport Name' },
  { key: 'city', label: 'City' },
  { key: 'country_name', label: 'Country' },
  { key: 'terminals', label: 'Terminals', render: (r) => (r.terminals && r.terminals.length > 0 ? r.terminals.join(', ') : '—') },
];

const EMPTY_FORM = {
  iata_code: '', airport_name: '', city: '', timezone: 'UTC',
  latitude: '', longitude: '', country: '', terminals: [''],
};

const validateForm = (form) => {
  const e = {};
  if (!form.iata_code || !/^[A-Za-z]{3}$/.test(form.iata_code.trim())) {
    e.iata_code = 'IATA code must be exactly 3 alphabetic characters.';
  }
  if (!form.airport_name || form.airport_name.trim().length < 3) {
    e.airport_name = 'Airport name must be at least 3 characters.';
  }
  if (!form.city || form.city.trim().length < 2) {
    e.city = 'City name must be at least 2 characters.';
  }
  if (!form.country) {
    e.country = 'Country is required.';
  }
  if (form.latitude !== '' && form.latitude !== null && form.latitude !== undefined) {
    const lat = Number(form.latitude);
    if (isNaN(lat) || lat < -90 || lat > 90) {
      e.latitude = 'Latitude must be a valid number between -90 and 90.';
    }
  }
  if (form.longitude !== '' && form.longitude !== null && form.longitude !== undefined) {
    const lon = Number(form.longitude);
    if (isNaN(lon) || lon < -180 || lon > 180) {
      e.longitude = 'Longitude must be a valid number between -180 and 180.';
    }
  }
  const validTerminals = (form.terminals || []).map((t) => (typeof t === 'string' ? t.trim() : '')).filter(Boolean);
  if (validTerminals.length === 0) {
    e.terminals = 'At least one terminal is required.';
  }
  return e;
};

const onBeforeSubmit = (form) => ({
  ...form,
  iata_code: form.iata_code.trim().toUpperCase(),
  airport_name: form.airport_name.trim(),
  city: form.city.trim(),
  latitude: form.latitude === '' || form.latitude === null ? null : Number(form.latitude),
  longitude: form.longitude === '' || form.longitude === null ? null : Number(form.longitude),
  terminals: (form.terminals || []).map((t) => (typeof t === 'string' ? t.trim() : '')).filter(Boolean),
});

const THUNKS = { fetchList: fetchAirports, fetchDetail: fetchAirportDetail, add: addAirport, update: updateAirport, remove: removeAirport };

export default function AirportsPage() {
  const [countries, setCountries] = useState([]);

  const loadCountries = useCallback(async () => {
    try {
      const res = await fetchWithAuth('/flights/v2/countries/?page_size=1000');
      setCountries(res?.results || (Array.isArray(res) ? res : []));
    } catch (err) {
      console.error('Failed to load countries for airports:', err);
    }
  }, []);

  useEffect(() => {
    loadCountries();
  }, [loadCountries]);

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

  const CONFIG = {
    title: 'Airports',
    entityName: 'airport',
    columns: COLUMNS,
    fields: FIELDS,
    emptyForm: EMPTY_FORM,
    validateForm,
    onBeforeSubmit,
    thunks: THUNKS,
    onOpenForm: loadCountries,
    getDeleteDetails: (item) => {
      if (!item) return null;
      const details = {};
      if (item.iata_code) {
        details['AIRPORT NAME'] = item.airport_name || item.name;
        details['IATA CODE'] = item.iata_code;
        if (item.city) details['CITY'] = item.city;
        if (item.country_name) details['COUNTRY'] = item.country_name;
      }
      return details;
    }
  };

  return <AdminCrudPage config={CONFIG} />;
}