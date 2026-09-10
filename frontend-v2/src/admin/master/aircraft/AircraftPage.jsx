import { useState, useEffect, useCallback } from 'react';
import AdminCrudPage from '@/admin/_core/AdminCrudPage';
import { fetchWithAuth } from '@/services/apiClient';
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
  if (!form.registration || !/^[A-Za-z0-9-]+$/.test(form.registration.trim())) {
    e.registration = 'Registration must be alphanumeric with hyphens (e.g. VT-ANB).';
  } else if (form.registration.trim().length > 20) {
    e.registration = 'Registration must be 20 characters or less.';
  }
  if (!form.airline) e.airline = 'Airline is required.';
  if (!form.aircraft_model) e.aircraft_model = 'Aircraft model is required.';

  const isInt = (val) => val !== '' && Number.isInteger(Number(val)) && Number(val) >= 0;
  if (!isInt(form.economy_capacity)) e.economy_capacity = 'Must be a non-negative integer.';
  if (!isInt(form.business_capacity)) e.business_capacity = 'Must be a non-negative integer.';
  if (!isInt(form.first_class_capacity)) e.first_class_capacity = 'Must be a non-negative integer.';

  const totalCap = Number(form.economy_capacity || 0) + Number(form.business_capacity || 0) + Number(form.first_class_capacity || 0);
  if (totalCap <= 0) {
    e.economy_capacity = 'Aircraft must have total seating capacity greater than 0.';
  }

  const layoutRegex = /^[1-9]\d*(?:-[1-9]\d*)*$/; // Disallows 0 or 0-0
  if (Number(form.economy_capacity) > 0) {
    if (!form.economy_layout || !layoutRegex.test(form.economy_layout)) {
      e.economy_layout = 'Valid layout required when economy capacity > 0 (e.g. 3-3).';
    }
  }
  if (Number(form.business_capacity) > 0) {
    if (!form.business_layout || !layoutRegex.test(form.business_layout)) {
      e.business_layout = 'Valid layout required when business capacity > 0 (e.g. 2-2).';
    }
  }
  if (Number(form.first_class_capacity) > 0) {
    if (!form.first_class_layout || !layoutRegex.test(form.first_class_layout)) {
      e.first_class_layout = 'Valid layout required when first class capacity > 0 (e.g. 2-2).';
    }
  }
  return e;
};

const THUNKS = { fetchList: fetchAircraft, fetchDetail: fetchAircraftDetail, add: addAircraft, update: updateAircraft, remove: removeAircraft };

export default function AircraftPage() {
  const [airlines, setAirlines] = useState([]);
  const [models, setModels] = useState([]);

  const loadLookups = useCallback(async () => {
    try {
      const [airlinesRes, modelsRes] = await Promise.all([
        fetchWithAuth('/flights/v2/airlines/?page_size=1000'),
        fetchWithAuth('/flights/v2/aircraft-models/?page_size=1000'),
      ]);
      setAirlines(airlinesRes?.results || (Array.isArray(airlinesRes) ? airlinesRes : []));
      setModels(modelsRes?.results || (Array.isArray(modelsRes) ? modelsRes : []));
    } catch (err) {
      console.error('Failed to load aircraft lookups:', err);
    }
  }, []);

  useEffect(() => {
    loadLookups();
  }, [loadLookups]);

  const airlineOptions = airlines.map((a) => ({ value: a.id, label: `${a.iata_airline_code} – ${a.airline_name}` }));
  const modelOptions = models.map((m) => ({ value: m.id, label: `${m.manufacturer} ${m.model_name}` }));

  const FIELDS = [
    { name: 'registration', label: 'Registration', placeholder: 'e.g. VT-ANB', autoUpper: true },
    { name: 'airline', label: 'Airline', type: 'select', options: airlineOptions },
    { name: 'aircraft_model', label: 'Aircraft Model', type: 'select', options: modelOptions },
    { name: 'economy_capacity', label: 'Economy Capacity', type: 'number', placeholder: '0' },
    { name: 'economy_layout', label: 'Economy Layout', placeholder: 'e.g. 3-3' },
    { name: 'business_capacity', label: 'Business Capacity', type: 'number', placeholder: '0' },
    { name: 'business_layout', label: 'Business Layout', placeholder: 'e.g. 2-2' },
    { name: 'first_class_capacity', label: 'First Class Capacity', type: 'number', placeholder: '0' },
    { name: 'first_class_layout', label: 'First Class Layout', placeholder: 'e.g. 2-2' },
  ];

  const CONFIG = {
    title: 'Aircraft',
    entityName: 'aircraft',
    columns: COLUMNS,
    fields: FIELDS,
    emptyForm: EMPTY_FORM,
    validateForm,
    thunks: THUNKS,
    onOpenForm: loadLookups,
    getDeleteDetails: (item) => {
      if (!item) return null;
      const details = {};
      if (item.registration) {
        details['REGISTRATION'] = item.registration;
        if (item.airline_name) details['AIRLINE'] = item.airline_name;
        if (item.model_display || item.aircraft_model_name) details['MODEL'] = item.model_display || item.aircraft_model_name;
      }
      return details;
    }
  };

  return <AdminCrudPage config={CONFIG} />;
}
