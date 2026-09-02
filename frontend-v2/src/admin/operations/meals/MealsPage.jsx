/**
 * MealsPage — Flight Meals scoped by Airline & Cabin Class with nested Food Items.
 * Food item dropdown in creation modal is filtered by selected airline.
 */
import { useEffect, useState, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { fetchWithAuth } from '@/services/apiClient';
import '@/admin/_core/styles/admin.css';
import DeleteConfirmationModal from '../../_core/DeleteConfirmationModal';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import {
  fetchFlightMeals, addFlightMeal, updateFlightMeal, removeFlightMeal,
  ADMIN_PAGE_SIZE,
} from '@/admin/_core/store/adminSlices';
import { Pagination } from '@/components/ui/Pagination';
import { Plus, Pencil, Trash2, Save, X, AlertCircle, PlusCircle, MinusCircle, ArrowLeft, Filter } from 'lucide-react';
import toast from 'react-hot-toast';
import useDeleteAction from '../../_core/hooks/useDeleteAction';
import { SpinnerLoader } from '@/components/ui/Loaders';
import { parseApiError } from '@/utils/errorUtils';

const CABIN_CLASS_OPTIONS = [
  { value: 'ECONOMY', label: 'Economy Class' },
  { value: 'BUSINESS', label: 'Business Class' },
  { value: 'FIRST', label: 'First Class' },
];

const EMPTY_ITEM = { food_item: '', quantity: 1 };

export default function MealsPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { items: meals, loading, actionLoading, count, error } = useSelector((s) => s.flightMeal);
  
  const [airlines, setAirlines] = useState([]);
  const [foodItems, setFoodItems] = useState([]);

  const [searchParams, setSearchParams] = useSearchParams();
  const airlineParam = searchParams.get('airline') || '';
  const cabinParam = searchParams.get('cabin_class') || '';

  const [filterAirline, setFilterAirline] = useState(airlineParam);
  const [filterCabin, setFilterCabin] = useState(cabinParam);

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({
    airline: airlineParam,
    cabin_class: cabinParam || 'ECONOMY',
    name: '',
    items: [{ ...EMPTY_ITEM }],
  });
  const [localErrors, setLocalErrors] = useState({});
  const [page, setPage] = useState(1);

  const loadMeals = useCallback((p, aFilter = filterAirline, cFilter = filterCabin) => {
    const params = { page: p };
    if (aFilter) params.airline = aFilter;
    if (cFilter) params.cabin_class = cFilter;
    dispatch(fetchFlightMeals(params));
  }, [dispatch, filterAirline, filterCabin]);

  useEffect(() => {
    loadMeals(page, filterAirline, filterCabin);
  }, [loadMeals, page, filterAirline, filterCabin]);

  const loadLookups = useCallback(() => {
    if (airlines.length === 0) {
      fetchWithAuth('/flights/v2/airlines/?page_size=1000')
        .then((data) => setAirlines(data.results || data || []))
        .catch((err) => console.error('Failed to load airlines lookup:', err));
    }
    if (foodItems.length === 0) {
      fetchWithAuth('/flights/v2/food-items/?page_size=1000')
        .then((data) => setFoodItems(data.results || data || []))
        .catch((err) => console.error('Failed to load food items lookup:', err));
    }
  }, [airlines.length, foodItems.length]);

  useEffect(() => {
    loadLookups();
  }, [loadLookups]);

  const airlineOptions = airlines.map((a) => ({
    value: a.id,
    label: `${a.airline_name} (${a.iata_airline_code})`,
  }));

  // Filter food items available for the selected airline in form
  const filteredFoodItems = form.airline
    ? foodItems.filter((fi) => String(fi.airline) === String(form.airline))
    : foodItems;
  const foodItemOptions = filteredFoodItems.map((fi) => ({ value: fi.id, label: fi.name }));

  const openCreate = useCallback(() => {
    loadLookups();
    setEditId(null);
    setForm({
      airline: filterAirline || airlineParam || '',
      cabin_class: filterCabin || cabinParam || 'ECONOMY',
      name: '',
      items: [{ ...EMPTY_ITEM }],
    });
    setLocalErrors({});
    setShowForm(true);
  }, [loadLookups, filterAirline, airlineParam, filterCabin, cabinParam]);

  const openEdit = (meal) => {
    loadLookups();
    setEditId(meal.id);
    setForm({
      airline: meal.airline,
      cabin_class: meal.cabin_class || 'ECONOMY',
      name: meal.name,
      items: (meal.items || []).map((i) => ({ food_item: i.food_item, quantity: i.quantity })),
    });
    setLocalErrors({});
    setShowForm(true);
  };
  const closeForm = () => { setShowForm(false); setEditId(null); };

  const addItem = () => setForm((f) => ({ ...f, items: [...f.items, { ...EMPTY_ITEM }] }));
  const removeItem = (i) => setForm((f) => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));
  const updateItem = (i, key, val) => setForm((f) => ({
    ...f, items: f.items.map((item, idx) => idx === i ? { ...item, [key]: val } : item),
  }));

  const validateForm = () => {
    const e = {};
    if (!form.airline) e.airline = 'Airline is required.';
    if (!form.cabin_class) e.cabin_class = 'Cabin class is required.';
    if (!form.name || form.name.trim().length < 2) e.name = 'Meal name must be at least 2 characters.';
    form.items.forEach((item, i) => {
      if (!item.food_item) e[`item_${i}`] = 'Food item is required.';
      if (!item.quantity || Number(item.quantity) < 1) e[`item_qty_${i}`] = 'Quantity must be ≥ 1.';
    });
    setLocalErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validateForm()) { toast.error('Fix validation errors.'); return; }
    const payload = {
      airline: form.airline,
      cabin_class: form.cabin_class,
      name: form.name,
      items: form.items.map(i => ({ food_item: i.food_item, quantity: Number(i.quantity) })),
    };
    const promise = editId
      ? dispatch(updateFlightMeal({ id: editId, data: payload })).unwrap()
      : dispatch(addFlightMeal(payload)).unwrap();
    toast.promise(promise, {
      loading: 'Saving meal…',
      success: () => { closeForm(); loadMeals(page); return 'Meal saved!'; },
      error: (err) => parseApiError(err, 'Failed to save flight meal.'),
    });
  };

  const { deleteItem, setDeleteItem, deleteLoading, confirmDelete } = useDeleteAction({
    thunk: removeFlightMeal,
    onSuccess: () => loadMeals(page),
    successMessage: 'Flight Meal deleted successfully.',
    errorMessage: 'Failed to delete flight meal.'
  });

  const getAirlineLabel = (meal) => {
    if (meal.airline_name && meal.airline_code) {
      return `${meal.airline_name} (${meal.airline_code})`;
    }
    const found = airlines.find(a => String(a.id) === String(meal.airline));
    return found ? `${found.airline_name} (${found.iata_airline_code})` : meal.airline;
  };

  const getCabinLabel = (code) => {
    const found = CABIN_CLASS_OPTIONS.find(c => c.value === code);
    return found ? found.label : code;
  };

  return (
    <div className="admin-page">
      <div className="admin-container">

        {airlineParam && (
          <div className="admin-breadcrumb" style={{ marginBottom: 16 }}>
            <span>
              <Link to="/admin/operations/airlines">Airlines</Link>
              <span style={{ margin: '0 8px' }}>/</span>
            </span>
            <span>Meals (Airline #{airlineParam})</span>
          </div>
        )}

        <div className="flex items-center gap-3.5 mb-7 justify-between">
          <div className="flex items-center gap-3.5">
            {airlineParam && (
              <button
                onClick={() => navigate('/admin/operations/airlines')}
                className="flex items-center gap-1.5 bg-black/5 border-none rounded-lg px-3.5 py-1.5 text-[13px] font-semibold text-[#555] cursor-pointer transition-colors hover:bg-black/10"
              >
                <ArrowLeft size={15} /> Back
              </button>
            )}
            <div>
              <h1 className="admin-page-title">Flight Meals</h1>
              <p className="admin-page-subtitle">Configure in-flight meals by airline & cabin class</p>
            </div>
          </div>
          <button className="btn-primary" onClick={openCreate}><Plus size={15} /> Add Meal</button>
        </div>

        {/* Filters bar */}
        <div className="admin-card p-4 mb-5 flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
            <Filter size={14} /> Filter By:
          </div>
          <div className="w-64">
            <Select
              id="filter-airline"
              options={[{ value: '', label: 'All Airlines' }, ...airlineOptions]}
              value={filterAirline}
              onChange={(e) => {
                const val = e.target.value;
                setFilterAirline(val);
                setPage(1);
                setSearchParams((prev) => {
                  const next = new URLSearchParams(prev);
                  if (val) next.set('airline', val); else next.delete('airline');
                  return next;
                });
              }}
            />
          </div>
          <div className="w-52">
            <Select
              id="filter-cabin"
              options={[{ value: '', label: 'All Cabin Classes' }, ...CABIN_CLASS_OPTIONS]}
              value={filterCabin}
              onChange={(e) => {
                const val = e.target.value;
                setFilterCabin(val);
                setPage(1);
                setSearchParams((prev) => {
                  const next = new URLSearchParams(prev);
                  if (val) next.set('cabin_class', val); else next.delete('cabin_class');
                  return next;
                });
              }}
            />
          </div>
          {(filterAirline || filterCabin) && (
            <button
              onClick={() => {
                setFilterAirline('');
                setFilterCabin('');
                setPage(1);
                setSearchParams({});
              }}
              className="text-xs text-amber-700 hover:underline font-semibold cursor-pointer border-none bg-transparent"
            >
              Reset Filters
            </button>
          )}
        </div>

        {error && (
          <div className="admin-error">
            <AlertCircle size={15} /><span>{String(error)}</span>
          </div>
        )}

        <div className="admin-card admin-table-wrap">
          {loading ? (
            <SpinnerLoader />
          ) : meals.length === 0 ? (
            <div className="admin-empty"><p>No meals found. Add one above.</p></div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Meal Name</th>
                  <th>Airline</th>
                  <th>Cabin Class</th>
                  <th>Items</th>
                  <th>Price</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {meals.map((meal) => (
                  <tr key={meal.id} className="admin-row">
                    <td><strong>{meal.name}</strong></td>
                    <td>{getAirlineLabel(meal)}</td>
                    <td>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                        {getCabinLabel(meal.cabin_class)}
                      </span>
                    </td>
                    <td>
                      {(meal.items || []).map((item, i) => (
                        <span key={i} className="text-[11px] bg-[rgba(112,93,0,0.08)] rounded-md px-1.5 py-0.5 mr-1">
                          {item.food_item_name || item.food_item} ×{item.quantity}
                        </span>
                      ))}
                    </td>
                    <td>${Number(meal.price || 0).toFixed(2)}</td>
                    <td className="text-right whitespace-nowrap">
                      <div className="flex gap-1.5 items-center justify-end">
                        <button className="btn-secondary" title="Edit" onClick={() => openEdit(meal)} style={{ padding: '6px 8px' }}>
                          <Pencil size={14} />
                        </button>
                        <button className="btn-danger" title="Delete" onClick={() => setDeleteItem(meal)} style={{ padding: '6px 8px' }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <Pagination
          currentPage={page}
          totalPages={Math.ceil((count || meals.length) / ADMIN_PAGE_SIZE) || 1}
          totalCount={count || meals.length || 0}
          pageSize={ADMIN_PAGE_SIZE}
          onPageChange={(p) => setPage(p)}
          entityLabel="meals"
        />
      </div>

      {showForm && (
        <div className="admin-modal-overlay" onClick={closeForm}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2 className="admin-modal-title">
                {editId ? 'Edit Flight Meal' : 'Add Flight Meal'}
              </h2>
              <button className="btn-icon" onClick={closeForm}><X size={16} /></button>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <Select
                  id="meal-airline"
                  label="Airline"
                  options={airlineOptions}
                  value={form.airline}
                  onChange={(e) => setForm((f) => ({ ...f, airline: e.target.value }))}
                  error={localErrors.airline}
                />
                <Select
                  id="meal-cabin-class"
                  label="Cabin Class"
                  options={CABIN_CLASS_OPTIONS}
                  value={form.cabin_class}
                  onChange={(e) => setForm((f) => ({ ...f, cabin_class: e.target.value }))}
                  error={localErrors.cabin_class}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <Input
                  id="meal-name"
                  label="Meal Name"
                  placeholder="e.g. Premium Veg Breakfast Set"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  error={localErrors.name}
                />
              </div>

              <div className="mb-5">
                <div className="flex justify-between items-center mb-2.5">
                  <span className="text-xs font-bold uppercase tracking-[.06em] text-[#705d00]">Meal Items</span>
                  <button type="button" className="btn-secondary" onClick={addItem} style={{ fontSize: 12, padding: '5px 10px' }}>
                    <PlusCircle size={13} /> Add Item
                  </button>
                </div>
                {form.items.map((item, i) => (
                  <div key={i} className="item-row">
                    <Select
                      id={`mi_food_${i}`}
                      label="Food Item"
                      options={foodItemOptions}
                      value={item.food_item}
                      onChange={(e) => updateItem(i, 'food_item', e.target.value)}
                      error={localErrors[`item_${i}`]}
                    />
                    <Input
                      id={`mi_qty_${i}`}
                      label="Qty"
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateItem(i, 'quantity', e.target.value)}
                      error={localErrors[`item_qty_${i}`]}
                    />
                    {form.items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(i)}
                        className="bg-transparent border-none cursor-pointer text-[#b91c1c] mb-1 p-0"
                      >
                        <MinusCircle size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2.5 mt-8">
                <button type="button" className="btn-secondary" onClick={closeForm}><X size={14} /> Cancel</button>
                <button type="submit" className="btn-primary" disabled={actionLoading}><Save size={14} /> {actionLoading ? 'Saving…' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <DeleteConfirmationModal
        isOpen={deleteItem !== null}
        loading={deleteLoading}
        title="Delete Meal"
        message="Are you sure you want to delete this meal?"
        details={(() => {
          if (!deleteItem) return null;
          return {
            NAME: deleteItem.name,
            AIRLINE: getAirlineLabel(deleteItem),
            CABIN: getCabinLabel(deleteItem.cabin_class),
          };
        })()}
        onClose={() => setDeleteItem(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
