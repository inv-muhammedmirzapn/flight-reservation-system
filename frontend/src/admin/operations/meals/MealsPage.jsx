/**
 * MealsPage — Flight Meals with nested Flight Meal Items.
 * Food item dropdown is filtered by the instance's airline.
 */
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import '@/admin/_core/styles/admin.css';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import {
  fetchFlightMeals, addFlightMeal, updateFlightMeal, removeFlightMeal,
  fetchFlightInstances, fetchFoodItems, fetchAirlines,
  fetchFlightRoutes,
} from '@/admin/_core/store/adminSlices';
import { Pagination } from '@/components/ui/Pagination';
import { Plus, Pencil, Trash2, Save, X, AlertCircle, PlusCircle, MinusCircle, ArrowLeft, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

const EMPTY_ITEM = { food_item: '', quantity: 1 };

export default function MealsPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { items: meals, loading, actionLoading, count, error } = useSelector((s) => s.flightMeal);
  const { items: instances } = useSelector((s) => s.flightInstance);
  const { items: foodItems } = useSelector((s) => s.foodItem);
  const { items: routes } = useSelector((s) => s.flightRoute);

  const [searchParams] = useSearchParams();
  const instanceParam = searchParams.get('instance') || '';

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ flight_instance: instanceParam, name: '', items: [{ ...EMPTY_ITEM }] });
  const [localErrors, setLocalErrors] = useState({});
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const loadMeals = (p) => {
    dispatch(fetchFlightMeals({ page: p, page_size: PAGE_SIZE, ...(instanceParam ? { flight_instance: instanceParam } : {}) }));
  };

  useEffect(() => {
    loadMeals(page);
    dispatch(fetchFlightInstances({ page_size: 500 }));
    dispatch(fetchFoodItems({ page_size: 500 }));
    dispatch(fetchFlightRoutes({ page_size: 500 }));
  }, [dispatch, instanceParam, page]);

  const instanceOptions = instances.map((i) => ({
    value: i.id,
    label: `${i.flight_no} — ${i.date}`,
  }));

  // Find airline of selected instance
  const selectedInstance = instances.find((i) => String(i.id) === String(form.flight_instance));
  const selectedRoute = selectedInstance
    ? routes.find((r) => String(r.id) === String(selectedInstance.flight))
    : null;
  const filteredFoodItems = selectedRoute
    ? foodItems.filter((fi) => String(fi.airline) === String(selectedRoute.airline))
    : foodItems;
  const foodItemOptions = filteredFoodItems.map((fi) => ({ value: fi.id, label: fi.name }));

  const openCreate = () => { setEditId(null); setForm({ flight_instance: instanceParam, name: '', items: [{ ...EMPTY_ITEM }] }); setLocalErrors({}); setShowForm(true); };
  const openEdit = (meal) => {
    setEditId(meal.id);
    setForm({
      flight_instance: meal.flight_instance,
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
    if (!form.flight_instance) e.flight_instance = 'Flight instance required.';
    if (!form.name || form.name.trim().length < 2) e.name = 'Meal name must be at least 2 characters.';
    form.items.forEach((item, i) => {
      if (!item.food_item) e[`item_${i}`] = 'Food item required.';
      if (!item.quantity || Number(item.quantity) < 1) e[`item_qty_${i}`] = 'Quantity must be ≥ 1.';
    });
    setLocalErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validateForm()) { toast.error('Fix validation errors.'); return; }
    const promise = editId
      ? dispatch(updateFlightMeal({ id: editId, data: form })).unwrap()
      : dispatch(addFlightMeal(form)).unwrap();
    toast.promise(promise, {
      loading: 'Saving meal…',
      success: () => { closeForm(); loadMeals(page); return 'Meal saved!'; },
      error: (err) => err?.non_field_errors?.[0] || 'Failed.',
    });
  };

  const handleDelete = (id) => {
    if (!window.confirm('Delete this meal?')) return;
    toast.promise(dispatch(removeFlightMeal(id)).unwrap(), {
      loading: 'Deleting…', success: 'Deleted.', error: 'Failed.',
    });
  };

  return (
    <>

      <div className="admin-page-wrap">
        {instanceParam && (
          <div className="bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/30 rounded-2xl p-4 mb-6 flex flex-wrap items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-700 text-white flex items-center justify-center font-black text-xs shadow">
                4/4
              </div>
              <div>
                <div className="text-xs font-extrabold uppercase tracking-wider text-emerald-700">
                  Instance Setup Flow • Step 4 (Flight Meals)
                </div>
                <div className="text-sm font-bold text-slate-800">
                  Configuring Meals for Flight Instance #{instanceParam}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate('/admin/operations/flight-instances')}
              className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-md cursor-pointer transition-all border-none"
            >
              <CheckCircle2 size={14} /> Finish Instance Setup ✓
            </button>
          </div>
        )}

        {instanceParam && (
          <div className="admin-breadcrumb" style={{ marginBottom: 16 }}>
            <span>
              <Link to="/admin/operations/flight-instances">Flight Instances</Link>
              <span style={{ margin: '0 8px' }}>/</span>
            </span>
            <span>Meals (Instance #{instanceParam})</span>
          </div>
        )}
        <div className="flex items-center gap-3.5 mb-7 justify-between">
          <div className="flex items-center gap-3.5">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-1.5 bg-black/5 border-none rounded-lg px-3.5 py-1.5 text-[13px] font-semibold text-[#555] cursor-pointer transition-colors hover:bg-black/10"
            >
              <ArrowLeft size={15} /> Back
            </button>
            <h1 className="admin-page-title">Flight Meals</h1>
          </div>
          <button className="btn-primary" onClick={openCreate}><Plus size={15} /> Add Meal</button>
        </div>

        {error && (
          <div className="admin-error">
            <AlertCircle size={15} /><span>{String(error)}</span>
          </div>
        )}

        <div className="admin-card admin-table-wrap">
          {loading ? (
            <div className="admin-spinner-wrap"><div className="admin-spinner" /></div>
          ) : meals.length === 0 ? (
            <div className="admin-empty"><p>No meals yet.</p></div>
          ) : (
            <table className="admin-table">
              <thead><tr><th>Meal Name</th><th>Flight Instance</th><th>Items</th><th>Actions</th></tr></thead>
              <tbody>
                {meals.map((meal) => (
                  <tr key={meal.id}>
                    <td><strong>{meal.name}</strong></td>
                    <td>{meal.flight_instance}</td>
                    <td>
                      {(meal.items || []).map((item, i) => (
                        <span key={i} className="text-[11px] bg-[rgba(112,93,0,0.08)] rounded-md px-1.5 py-0.5 mr-1">
                          {item.food_item_name || item.food_item} ×{item.quantity}
                        </span>
                      ))}
                    </td>
                    <td>
                      <div className="flex gap-1.5">
                        <button className="btn-secondary" onClick={() => openEdit(meal)}><Pencil size={13} /> Edit</button>
                        <button className="btn-danger" onClick={() => handleDelete(meal.id)}><Trash2 size={13} /> Delete</button>
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
          totalPages={Math.ceil((count || meals.length) / PAGE_SIZE) || 1}
          totalCount={count || meals.length || 0}
          pageSize={PAGE_SIZE}
          onPageChange={(p) => setPage(p)}
          entityLabel="meals"
        />
      </div>

      {showForm && (
        <div className="admin-modal-overlay" onClick={closeForm}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2 className="admin-modal-title">
                {editId ? 'Edit Meal' : 'Add Meal'}
              </h2>
              <button className="btn-icon" onClick={closeForm}><X size={16} /></button>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                <Select id="meal-instance" label="Flight Instance" options={instanceOptions}
                  value={form.flight_instance}
                  onChange={(e) => setForm((f) => ({ ...f, flight_instance: e.target.value }))}
                  error={localErrors.flight_instance} />
                <Input id="meal-name" label="Meal Name" placeholder="e.g. Veg Breakfast Set"
                  value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  error={localErrors.name} />
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
                    <Select id={`mi_food_${i}`} label="Food Item" options={foodItemOptions}
                      value={item.food_item}
                      onChange={(e) => updateItem(i, 'food_item', e.target.value)}
                      error={localErrors[`item_${i}`]} />
                    <Input id={`mi_qty_${i}`} label="Qty" type="number" value={item.quantity}
                      onChange={(e) => updateItem(i, 'quantity', e.target.value)}
                      error={localErrors[`item_qty_${i}`]} />
                    {form.items.length > 1 && (
                      <button type="button" onClick={() => removeItem(i)}
                        className="bg-transparent border-none cursor-pointer text-[#b91c1c] mb-1 p-0">
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
    </>
  );
}
