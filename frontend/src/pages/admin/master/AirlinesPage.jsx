import AdminCrudPage from '../AdminCrudPage';
import {
  fetchAirlines, fetchAirlineDetail, addAirline, updateAirline, removeAirline,
} from '@/store/adminSlices';

const COLUMNS = [
  { key: 'iata_airline_code', label: 'IATA Code' },
  { key: 'airline_name', label: 'Airline Name' },
];

const FIELDS = [
  { name: 'iata_airline_code', label: 'IATA Airline Code (2 chars)', placeholder: 'e.g. AA', autoUpper: true },
  { name: 'airline_name', label: 'Airline Name', placeholder: 'e.g. American Airlines' },
];

const EMPTY_FORM = { iata_airline_code: '', airline_name: '' };

const validateForm = (form) => {
  const e = {};
  if (!form.iata_airline_code || !/^[A-Za-z0-9]{2}$/.test(form.iata_airline_code.trim())) e.iata_airline_code = 'IATA code must be exactly 2 alphanumeric characters.';
  if (!form.airline_name || form.airline_name.trim().length < 2) e.airline_name = 'Airline name must be at least 2 characters.';
  return e;
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
      thunks={THUNKS}
    />
  );
}
