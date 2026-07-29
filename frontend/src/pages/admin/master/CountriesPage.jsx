import AdminCrudPage from '../AdminCrudPage';
import {
  fetchCountries, fetchCountryDetail, addCountry, updateCountry, removeCountry,
} from '@/store/adminSlices';

const COLUMNS = [
  { key: 'id', label: 'ID', render: (r) => String(r.id).slice(0, 8) + '…' },
  { key: 'name', label: 'Name' },
  { key: 'iso_code', label: 'ISO Code' },
];

const FIELDS = [
  { name: 'name', label: 'Country Name', placeholder: 'e.g. United States' },
  { name: 'iso_code', label: 'ISO Code (2-3 chars)', placeholder: 'e.g. US', autoUpper: true },
];

const EMPTY_FORM = { name: '', iso_code: '' };

const validateForm = (form) => {
  const e = {};
  if (!form.name || form.name.trim().length < 2) e.name = 'Country name must be at least 2 characters.';
  if (!form.iso_code || !/^[A-Za-z]{2,3}$/.test(form.iso_code.trim())) e.iso_code = 'ISO code must be 2-3 alphabetic characters.';
  return e;
};

const THUNKS = { fetchList: fetchCountries, fetchDetail: fetchCountryDetail, add: addCountry, update: updateCountry, remove: removeCountry };

export default function CountriesPage() {
  return (
    <AdminCrudPage
      title="Countries"
      entityName="country"
      columns={COLUMNS}
      fields={FIELDS}
      emptyForm={EMPTY_FORM}
      validateForm={validateForm}
      thunks={THUNKS}
    />
  );
}
