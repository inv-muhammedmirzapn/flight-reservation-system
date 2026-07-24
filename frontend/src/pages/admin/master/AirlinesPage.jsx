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
  if (!form.iata_airline_code || form.iata_airline_code.length !== 2) e.iata_airline_code = 'IATA code must be exactly 2 characters.';
  if (!form.airline_name) e.airline_name = 'Airline name is required.';
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
