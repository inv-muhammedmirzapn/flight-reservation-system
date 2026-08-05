import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import AdminCrudPage from '@/admin/_core/AdminCrudPage';
import { fetchAirlines } from '@/admin/_core/store/adminSlices';
import {
  fetchFoodItems, fetchFoodItemDetail, addFoodItem, updateFoodItem, removeFoodItem,
} from '@/admin/_core/store/adminSlices';
import { API_BASE_URL } from '@/services/apiClient';

const COLUMNS = [
  {
    key: 'image', label: 'Image',
    render: (r) => r.image_url ? (
      <img src={r.image_url} alt={r.name} style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover' }} />
    ) : '—',
  },
  { key: 'name', label: 'Name' },
  { key: 'airline_name', label: 'Airline' },
  { key: 'price', label: 'Price', render: (r) => `${r.currency} ${r.price}` },
  {
    key: 'dietary', label: 'Dietary',
    render: (r) => [r.is_veg && 'Veg', r.is_halal && 'Halal', r.is_vegan && 'Vegan'].filter(Boolean).join(', ') || '—',
  },
];

const EMPTY_FORM = {
  airline: '', name: '', price: '', currency: 'INR',
  is_veg: false, is_halal: false, is_vegan: false, image: null,
};

const validateForm = (form) => {
  const e = {};
  if (!form.airline) e.airline = 'Airline is required.';
  if (!form.name || form.name.trim().length < 2) e.name = 'Name must be at least 2 characters.';
  if (form.price === '' || Number(form.price) < 0) e.price = 'Price must be a valid non-negative number.';
  return e;
};

// Food item uses multipart for image upload
const onBeforeSubmit = (form) => {
  const fd = new FormData();
  Object.entries(form).forEach(([k, v]) => {
    if (v !== null && v !== undefined) fd.append(k, v);
  });
  return fd;
};

const THUNKS = { fetchList: fetchFoodItems, fetchDetail: fetchFoodItemDetail, add: addFoodItem, update: updateFoodItem, remove: removeFoodItem };

export default function FoodItemsPage() {
  const dispatch = useDispatch();
  const { items: airlines } = useSelector((s) => s.airline);
  useEffect(() => { dispatch(fetchAirlines({})); }, [dispatch]);

  const airlineOptions = airlines.map((a) => ({ value: a.id, label: `${a.iata_airline_code} – ${a.airline_name}` }));

  const FIELDS = [
    { name: 'airline', label: 'Airline', type: 'select', options: airlineOptions },
    { name: 'name', label: 'Item Name', placeholder: 'e.g. Veg Biryani' },
    { name: 'price', label: 'Price', type: 'number', placeholder: '0' },
    { name: 'currency', label: 'Currency', placeholder: 'INR' },
    { name: 'is_veg', label: 'Vegetarian', type: 'checkbox' },
    { name: 'is_halal', label: 'Halal', type: 'checkbox' },
    { name: 'is_vegan', label: 'Vegan', type: 'checkbox' },
    { name: 'image', label: 'Image (optional)', type: 'file', fullWidth: true },
  ];

  return (
    <AdminCrudPage
      title="Food Items"
      entityName="foodItem"
      columns={COLUMNS}
      fields={FIELDS}
      emptyForm={EMPTY_FORM}
      validateForm={validateForm}
      onBeforeSubmit={onBeforeSubmit}
      thunks={THUNKS}
    />
  );
}
