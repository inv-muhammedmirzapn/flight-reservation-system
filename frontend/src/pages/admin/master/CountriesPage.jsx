import { useDispatch } from 'react-redux';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Globe } from 'lucide-react';
import AdminCrudPage from '../AdminCrudPage';
import {
  fetchCountries, fetchCountryDetail, addCountry, updateCountry, removeCountry,
  populateCountries,
} from '@/store/adminSlices';

const COLUMNS = [
  { key: 'id', label: 'ID', render: (r) => {
    const idStr = String(r.id);
    return idStr.length > 8 ? idStr.slice(0, 8) + '…' : idStr;
  }},
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
  const dispatch = useDispatch();
  const [populating, setPopulating] = useState(false);

  const handlePopulate = async () => {
    if (!window.confirm('This will fetch and import all standard ISO-compliant country codes and names from pycountry into the database. Existing countries with matching ISO codes will have their names updated. Proceed?')) return;
    
    setPopulating(true);
    try {
      const result = await dispatch(populateCountries()).unwrap();
      toast.success(result.detail || 'Successfully populated country presets!');
      // reload list
      dispatch(fetchCountries({ page: 1, page_size: 10 }));
    } catch (err) {
      toast.error(err || 'Failed to populate countries.');
    } finally {
      setPopulating(false);
    }
  };

  const pageActions = (
    <button 
      className="btn-secondary" 
      onClick={handlePopulate} 
      disabled={populating}
      style={{ display: 'flex', alignItems: 'center', gap: 6 }}
    >
      <Globe size={15} />
      {populating ? 'Populating…' : 'Populate Countries'}
    </button>
  );

  return (
    <AdminCrudPage
      title="Countries"
      entityName="country"
      columns={COLUMNS}
      fields={FIELDS}
      emptyForm={EMPTY_FORM}
      validateForm={validateForm}
      thunks={THUNKS}
      pageActions={pageActions}
    />
  );
}
