import AdminCrudPage from '@/admin/_core/AdminCrudPage';
import {
  fetchAirlines, fetchAirlineDetail, addAirline, updateAirline, removeAirline,
} from '@/admin/_core/store/adminSlices';

const COLUMNS = [
  {
    key: 'logo', label: 'Logo',
    render: (r) => r.logo_url ? (
      <img src={r.logo_url} alt={r.airline_name} style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'contain' }} />
    ) : '—',
  },
  { key: 'iata_airline_code', label: 'IATA Code' },
  { key: 'airline_name', label: 'Airline Name' },
];

const FIELDS = [
  { name: 'iata_airline_code', label: 'IATA Airline Code (2 chars)', placeholder: 'e.g. AA', autoUpper: true },
  { name: 'airline_name', label: 'Airline Name', placeholder: 'e.g. American Airlines' },
  { name: 'logo', label: 'Logo (optional)', type: 'file', fullWidth: true },
];

const EMPTY_FORM = { iata_airline_code: '', airline_name: '', logo: null };

const validateForm = (form) => {
  const e = {};
  if (!form.iata_airline_code || !/^[A-Za-z0-9]{2}$/.test(form.iata_airline_code.trim())) {
    e.iata_airline_code = 'IATA code must be exactly 2 alphanumeric characters.';
  }
  if (!form.airline_name || form.airline_name.trim().length < 2) {
    e.airline_name = 'Airline name must be at least 2 characters.';
  }
  if (form.logo instanceof File) {
    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];
    if (!allowed.includes(form.logo.type)) {
      e.logo = 'Logo must be a PNG, JPG, WEBP, or SVG image.';
    } else if (form.logo.size > 2 * 1024 * 1024) {
      e.logo = 'Logo file size must not exceed 2MB.';
    }
  }
  return e;
};

// Airline uses multipart for logo upload
const onBeforeSubmit = (form) => {
  const fd = new FormData();
  fd.append('iata_airline_code', form.iata_airline_code.trim().toUpperCase());
  fd.append('airline_name', form.airline_name.trim());
  if (form.logo instanceof File) {
    fd.append('logo', form.logo);
  }
  return fd;
};

const THUNKS = { fetchList: fetchAirlines, fetchDetail: fetchAirlineDetail, add: addAirline, update: updateAirline, remove: removeAirline };

const CONFIG = {
  title: 'Airlines',
  entityName: 'airline',
  columns: COLUMNS,
  fields: FIELDS,
  emptyForm: EMPTY_FORM,
  validateForm,
  onBeforeSubmit,
  thunks: THUNKS,
  getDeleteDetails: (item) => {
    if (!item) return null;
    const details = {};
    if (item.iata_airline_code) {
      details['AIRLINE NAME'] = item.airline_name || item.name;
      details['IATA CODE'] = item.iata_airline_code;
      if (item.country_name || item.country) details['COUNTRY'] = item.country_name || item.country;
    }
    return details;
  }
};

export default function AirlinesPage() {
  return <AdminCrudPage config={CONFIG} />;
}
