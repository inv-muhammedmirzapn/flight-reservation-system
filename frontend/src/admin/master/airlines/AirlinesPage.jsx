import AdminCrudPage from '@/admin/_core/AdminCrudPage';
import {
  fetchAirlines, fetchAirlineDetail, addAirline, updateAirline, removeAirline,
} from '@/admin/_core/store/adminSlices';

const COLUMNS = [
  {
    key: 'logo', label: 'Logo',
    render: (r) => r.logo_url ? (
      <img src={r.logo_url} alt={r.airline_name} className="w-9 h-9 rounded-md object-contain" />
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
  if (!form.iata_airline_code || !/^[A-Za-z0-9]{2}$/.test(form.iata_airline_code.trim())) e.iata_airline_code = 'IATA code must be exactly 2 alphanumeric characters.';
  if (!form.airline_name || form.airline_name.trim().length < 2) e.airline_name = 'Airline name must be at least 2 characters.';
  return e;
};

// Airline uses multipart for logo upload
const onBeforeSubmit = (form) => {
  const fd = new FormData();
  Object.entries(form).forEach(([k, v]) => {
    if (v !== null && v !== undefined) fd.append(k, v);
  });
  return fd;
};

const THUNKS = { fetchList: fetchAirlines, fetchDetail: fetchAirlineDetail, add: addAirline, update: updateAirline, remove: removeAirline };

export default function AirlinesPage() {
  return (
    <AdminCrudPage
      title="Airlines"
      entityName="airline"
      columns={COLUMNS}
      fields={FIELDS}
      emptyForm={EMPTY_FORM}
      validateForm={validateForm}
      onBeforeSubmit={onBeforeSubmit}
      thunks={THUNKS}
    />
  );
}
