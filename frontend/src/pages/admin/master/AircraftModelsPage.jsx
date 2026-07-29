import AdminCrudPage from '../AdminCrudPage';
import {
  fetchAircraftModels, fetchAircraftModelDetail, addAircraftModel,
  updateAircraftModel, removeAircraftModel,
} from '@/store/adminSlices';

const COLUMNS = [
  { key: 'manufacturer', label: 'Manufacturer' },
  { key: 'model_name', label: 'Model Name' },
];

const FIELDS = [
  { name: 'manufacturer', label: 'Manufacturer', placeholder: 'e.g. Boeing' },
  { name: 'model_name', label: 'Model Name', placeholder: 'e.g. 787 Dreamliner' },
];

const EMPTY_FORM = { manufacturer: '', model_name: '' };

const validateForm = (form) => {
  const e = {};
  if (!form.manufacturer || form.manufacturer.trim().length < 2) e.manufacturer = 'Manufacturer must be at least 2 characters.';
  if (!form.model_name || form.model_name.trim().length < 2) e.model_name = 'Model name must be at least 2 characters.';
  return e;
};

const THUNKS = { fetchList: fetchAircraftModels, fetchDetail: fetchAircraftModelDetail, add: addAircraftModel, update: updateAircraftModel, remove: removeAircraftModel };

export default function AircraftModelsPage() {
  return (
    <AdminCrudPage
      title="Aircraft Models"
      entityName="aircraftModel"
      columns={COLUMNS}
      fields={FIELDS}
      emptyForm={EMPTY_FORM}
      validateForm={validateForm}
      thunks={THUNKS}
    />
  );
}
