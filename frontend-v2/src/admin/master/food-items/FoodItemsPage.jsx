import { useState, useEffect, useCallback } from 'react';
import AdminCrudPage from '@/admin/_core/AdminCrudPage';
import { fetchWithAuth } from '@/services/apiClient';
import {
  fetchFoodItems, fetchFoodItemDetail, addFoodItem, updateFoodItem, removeFoodItem,
} from '@/admin/_core/store/adminSlices';

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
  if (form.price === '' || isNaN(Number(form.price)) || Number(form.price) < 0) {
    e.price = 'Price must be a valid non-negative number.';
  }
  if (!form.currency || !/^[A-Za-z]{3}$/.test(form.currency.trim())) {
    e.currency = 'Currency must be a 3-letter code (e.g. INR).';
  }
  if (form.image instanceof File) {
    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowed.includes(form.image.type)) {
      e.image = 'Image must be a PNG, JPG, or WEBP file.';
    } else if (form.image.size > 2 * 1024 * 1024) {
      e.image = 'Image size must not exceed 2MB.';
    }
  }
  return e;
};

// Food item uses multipart for image upload
const onBeforeSubmit = (form) => {
  const fd = new FormData();
  fd.append('airline', form.airline);
  fd.append('name', form.name.trim());
  fd.append('price', Number(form.price).toFixed(2));
  fd.append('currency', form.currency.trim().toUpperCase());
  fd.append('is_veg', form.is_vegan ? 'true' : String(!!form.is_veg));
  fd.append('is_halal', String(!!form.is_halal));
  fd.append('is_vegan', String(!!form.is_vegan));
  if (form.image instanceof File) {
    fd.append('image', form.image);
  }
  return fd;
};

const THUNKS = { fetchList: fetchFoodItems, fetchDetail: fetchFoodItemDetail, add: addFoodItem, update: updateFoodItem, remove: removeFoodItem };

export default function FoodItemsPage() {
  const [airlines, setAirlines] = useState([]);

  const loadLookups = useCallback(async () => {
    try {
      const res = await fetchWithAuth('/flights/v2/airlines/?page_size=1000');
      setAirlines(res?.results || (Array.isArray(res) ? res : []));
    } catch (err) {
      console.error('Failed to load airlines lookup for food items:', err);
    }
  }, []);

  useEffect(() => {
    loadLookups();
  }, [loadLookups]);

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

  const CONFIG = {
    title: 'Food Items',
    entityName: 'foodItem',
    columns: COLUMNS,
    fields: FIELDS,
    emptyForm: EMPTY_FORM,
    validateForm,
    onBeforeSubmit,
    thunks: THUNKS,
    onOpenForm: loadLookups,
    getDeleteDetails: (item) => {
      if (!item) return null;
      const details = {};
      if (item.name || item.item_name) details['ITEM NAME'] = item.name || item.item_name;
      if (item.airline_name) details['AIRLINE'] = item.airline_name;
      if (item.price !== undefined && item.price !== null) details['PRICE'] = `${item.currency || 'INR'} ${item.price}`;
      return details;
    }
  };

  return <AdminCrudPage config={CONFIG} />;
}
