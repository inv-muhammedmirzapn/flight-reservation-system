/**
 * MealsPage — Flight Meals with nested Flight Meal Items.
 * Food item dropdown is filtered by the instance's airline.
 */
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import '@/styles/admin-system.css';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import {
  fetchFlightMeals, addFlightMeal, updateFlightMeal, removeFlightMeal,
  fetchFlightInstances, fetchFoodItems, fetchAirlines,
  fetchFlightRoutes,
} from '@/store/adminSlices';
import { Pagination } from '@/components/ui/Pagination';
import { Plus, Pencil, Trash2, Save, X, AlertCircle, PlusCircle, MinusCircle, ArrowLeft } from 'lucide-react';
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
      <style>{`
        .item-row { background:rgba(112,93,0,0.04); border:1px solid rgba(112,93,0,0.12); border-radius:10px; padding:12px; margin-bottom:10px; display:grid; grid-template-columns:1fr auto auto; gap:10px; align-items:end; }
      `}</style>

      <div style={{ width: '95%', maxWidth: 1800, margin: '0 auto', padding: '88px 24px 48px' }}>
        {instanceParam && (
          <div className="admin-breadcrumb" style={{ marginBottom: 16 }}>
            <span>
              <Link to="/admin/operations/flight-instances">Flight Instances</Link>
              <span style={{ margin: '0 8px' }}>/</span>
            </span>
            <span>Meals (Instance #{instanceParam})</span>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28, justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button
              onClick={() => navigate(-1)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(0,0,0,0.05)', border: 'none', borderRadius: 8, padding: '7px 13px', fontSize: 13, fontWeight: 600, color: '#555', cursor: 'pointer', transition: 'background 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.1)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0.05)'}
            >
              <ArrowLeft size={15} /> Back
            </button>
            <h1 style={{ fontFamily: "'Plus Jakarta Sans', Inter, sans-serif", fontSize: 28, fontWeight: 800, color: '#1a1c1d', margin: 0 }}>Flight Meals</h1>
          </div>
          <button className="btn-primary" onClick={openCreate}><Plus size={15} /> Add Meal</button>
        </div>

        {error && (
          <div style={{ display: 'flex', gap: 8, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '12px 16px', color: '#b91c1c', marginBottom: 20, fontSize: 13 }}>
            <AlertCircle size={15} /><span>{String(error)}</span>
          </div>
        )}

        <div className="admin-card admin-table-wrap">
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
              <div style={{ width: 36, height: 36, border: '3px solid rgba(112,93,0,0.15)', borderTopColor: '#705d00', borderRadius: '50%', animation: 'spin 0.75s linear infinite' }} />
            </div>
          ) : meals.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48, color: '#888', fontSize: 14 }}>No meals yet.</div>
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
                        <span key={i} style={{ fontSize: 11, background: 'rgba(112,93,0,0.08)', borderRadius: 6, padding: '2px 7px', marginRight: 4 }}>
                          {item.food_item_name || item.food_item} ×{item.quantity}
                        </span>
                      ))}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
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

              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: '#705d00' }}>Meal Items</span>
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
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b91c1c', marginBottom: 4 }}>
                        <MinusCircle size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 32 }}>
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
