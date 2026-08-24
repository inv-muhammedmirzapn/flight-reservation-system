/**
 * RouteFareClassesPage — Manage RouteFareClass base templates per Flight Route.
 * Supports 1 base fare template per cabin class per route.
 */
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useSearchParams } from 'react-router-dom';
import { fetchWithAuth } from '@/services/apiClient';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Pagination } from '@/components/ui/Pagination';
import '@/admin/_core/styles/admin.css';
import DeleteConfirmationModal from '../../_core/DeleteConfirmationModal';
import {
  fetchRouteFareClasses, addRouteFareClass, updateRouteFareClass,
  updateRouteFareClassPrice, removeRouteFareClass,
  routeFareClassActions, ADMIN_PAGE_SIZE,
} from '@/admin/_core/store/adminSlices';
import {
  Plus, Pencil, Trash2, Save, X, AlertCircle, Search,
  RefreshCw, DollarSign, Tag, Check, Info,
} from 'lucide-react';
import toast from 'react-hot-toast';
import useDeleteAction from '../../_core/hooks/useDeleteAction';
import { SpinnerLoader } from '@/components/ui/Loaders';
import { parseApiError } from '@/utils/errorUtils';

const ALL_CABIN_OPTIONS = [
  { value: 'ECONOMY', label: 'Economy' },
  { value: 'BUSINESS', label: 'Business' },
  { value: 'FIRST', label: 'First' },
];

const REFUND_OPTIONS = [
  { value: 'NON_REFUNDABLE', label: 'Non-Refundable' },
  { value: 'REFUNDABLE', label: 'Refundable' },
  { value: 'PARTIAL', label: 'Partial Refund' },
];

const EMPTY_FORM = {
  route: '',
  cabin_class: 'ECONOMY',
  base_price: '',
  currency: 'INR',
  refund_type: 'NON_REFUNDABLE',
  change_fee: '0',
  meal_included: false,
  baggage_weight_allowed_kg: '15',
  extra_baggage_price_per_kg: '500',
};

export default function RouteFareClassesPage() {
  const dispatch = useDispatch();
  const [searchParams, setSearchParams] = useSearchParams();
  const routeParam = searchParams.get('route');

  const { items: templates, loading, actionLoading, count, error, validationErrors } = useSelector((s) => s.routeFareClass);

  const [routes, setRoutes] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [localErrors, setLocalErrors] = useState({});
  const [search, setSearch] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [selectedRouteFilter, setSelectedRouteFilter] = useState(routeParam || '');
  const [selectedCabinFilter, setSelectedCabinFilter] = useState('');
  const [page, setPage] = useState(1);

  // Repricing modal state
  const [repriceItem, setRepriceItem] = useState(null);
  const [newBasePrice, setNewBasePrice] = useState('');
  const [repriceLoading, setRepriceLoading] = useState(false);

  const load = useCallback((s, p, rFilter, cFilter) => {
    const params = { search: s, page: p };
    if (rFilter) params.route = rFilter;
    if (cFilter) params.cabin_class = cFilter;
    dispatch(fetchRouteFareClasses(params));
  }, [dispatch]);

  useEffect(() => {
    load(activeSearch, page, selectedRouteFilter, selectedCabinFilter);
  }, [load, activeSearch, page, selectedRouteFilter, selectedCabinFilter]);

  const loadRoutes = () => {
    if (routes.length === 0) {
      fetchWithAuth('/flights/v2/flight-routes/?page_size=1000')
        .then((data) => setRoutes(data.results || data || []))
        .catch((err) => console.error('Failed to load flight routes lookup:', err));
    }
  };

  useEffect(() => {
    loadRoutes();
  }, []);

  const routeOptions = routes.map((r) => ({
    value: String(r.id),
    label: `${r.flight_no} (${r.airline_name || 'Airline'})`,
  }));

  const filterRouteOptions = [
    { value: '', label: 'All Routes' },
    ...routeOptions,
  ];

  const filterCabinOptions = [
    { value: '', label: 'All Cabins' },
    ...ALL_CABIN_OPTIONS,
  ];

  // Selected route object for route default calculations
  const selectedRouteObj = useMemo(() => {
    return routes.find((r) => String(r.id) === String(form.route));
  }, [routes, form.route]);

  const minBaggageAllowed = selectedRouteObj?.baggage_weight_allowed_per_person
    ? Number(selectedRouteObj.baggage_weight_allowed_per_person)
    : 0;

  // Calculate existing cabin classes for the selected route in form
  const availableCabinOptions = useMemo(() => {
    if (!form.route) return ALL_CABIN_OPTIONS;

    const existingCabinsForRoute = templates
      .filter((t) => String(t.route) === String(form.route) && t.id !== editId)
      .map((t) => t.cabin_class);

    const filtered = ALL_CABIN_OPTIONS.filter((opt) => !existingCabinsForRoute.includes(opt.value));
    return filtered.length > 0 ? filtered : ALL_CABIN_OPTIONS;
  }, [form.route, templates, editId]);

  const openCreate = () => {
    loadRoutes();
    dispatch(routeFareClassActions.clearErrors());
    setEditId(null);
    const initialRoute = selectedRouteFilter || (routeOptions[0]?.value || '');
    const matchedRoute = routes.find((r) => String(r.id) === String(initialRoute));
    const initialBaggage = matchedRoute?.baggage_weight_allowed_per_person
      ? String(matchedRoute.baggage_weight_allowed_per_person)
      : '15';

    setForm({
      ...EMPTY_FORM,
      route: initialRoute,
      cabin_class: 'ECONOMY',
      baggage_weight_allowed_kg: initialBaggage,
    });
    setLocalErrors({});
    setShowForm(true);
  };

  const openEdit = (tmpl) => {
    loadRoutes();
    dispatch(routeFareClassActions.clearErrors());
    setEditId(tmpl.id);
    setForm({
      route: tmpl.route ? String(tmpl.route) : '',
      cabin_class: tmpl.cabin_class || 'ECONOMY',
      base_price: tmpl.base_price !== undefined ? String(tmpl.base_price) : '',
      currency: tmpl.currency || 'INR',
      refund_type: tmpl.refund_type || 'NON_REFUNDABLE',
      change_fee: tmpl.change_fee !== undefined ? String(tmpl.change_fee) : '0',
      meal_included: !!tmpl.meal_included,
      baggage_weight_allowed_kg: tmpl.baggage_weight_allowed_kg !== undefined ? String(tmpl.baggage_weight_allowed_kg) : '15',
      extra_baggage_price_per_kg: tmpl.extra_baggage_price_per_kg !== undefined ? String(tmpl.extra_baggage_price_per_kg) : '500',
    });
    setLocalErrors({});
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditId(null);
    dispatch(routeFareClassActions.clearErrors());
  };

  const validateForm = () => {
    const e = {};
    if (!form.route) e.route = 'Flight route is required.';
    if (!form.cabin_class) e.cabin_class = 'Cabin class is required.';
    if (form.base_price === '' || Number(form.base_price) < 0) {
      e.base_price = 'Base price must be a non-negative number.';
    }
    if (form.change_fee === '' || Number(form.change_fee) < 0) {
      e.change_fee = 'Change fee must be 0 or a positive number.';
    }
    if (form.baggage_weight_allowed_kg !== '' && Number(form.baggage_weight_allowed_kg) < minBaggageAllowed) {
      e.baggage_weight_allowed_kg = `Baggage allowance cannot be less than the route default (${minBaggageAllowed} kg).`;
    }

    // Check duplicate locally
    if (!editId && form.route && form.cabin_class) {
      const exists = templates.some(
        (t) => String(t.route) === String(form.route) && t.cabin_class === form.cabin_class
      );
      if (exists) {
        e.cabin_class = `A fare template for ${form.cabin_class} already exists on this route.`;
      }
    }

    setLocalErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!validateForm()) {
      toast.error('Please fix validation errors in the form.');
      return;
    }

    const payload = {
      ...form,
      route: Number(form.route),
      fare_code: form.cabin_class,
      base_price: Number(form.base_price),
      change_fee: Number(form.change_fee),
      baggage_weight_allowed_kg: Number(form.baggage_weight_allowed_kg || minBaggageAllowed),
      extra_baggage_price_per_kg: Number(form.extra_baggage_price_per_kg || 500),
    };

    let promise;
    if (editId) {
      promise = dispatch(updateRouteFareClass({ id: editId, data: payload })).unwrap();
    } else {
      promise = dispatch(addRouteFareClass(payload)).unwrap();
    }

    try {
      await promise;
      toast.success(editId ? 'Fare template updated!' : 'Fare template created!');
      closeForm();
      load(activeSearch, page, selectedRouteFilter, selectedCabinFilter);
    } catch (err) {
      toast.error(parseApiError(err, 'Failed to save fare template. Check if cabin class already exists or baggage is below route default.'));
    }
  };

  // ─── Repricing logic ────────────────────────────────────────────────────────
  const openRepriceModal = (tmpl) => {
    setRepriceItem(tmpl);
    setNewBasePrice(String(tmpl.base_price));
  };

  const handleRepriceSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!newBasePrice || Number(newBasePrice) < 0) {
      toast.error('Enter a valid non-negative base price.');
      return;
    }

    setRepriceLoading(true);
    try {
      const res = await dispatch(
        updateRouteFareClassPrice({
          id: repriceItem.id,
          newBasePrice: Number(newBasePrice),
        })
      ).unwrap();

      toast.success(
        res?.message || `Base price updated & future unsold fares repriced!`
      );
      setRepriceItem(null);
      load(activeSearch, page, selectedRouteFilter, selectedCabinFilter);
    } catch (err) {
      toast.error(parseApiError(err, 'Failed to reprice template.'));
    } finally {
      setRepriceLoading(false);
    }
  };

  const { deleteItem, setDeleteItem, deleteLoading, confirmDelete } = useDeleteAction({
    thunk: removeRouteFareClass,
    onSuccess: () => load(activeSearch, page, selectedRouteFilter, selectedCabinFilter),
    successMessage: 'Fare template deleted successfully.',
    errorMessage: 'Failed to delete fare template.',
  });

  const totalPages = count ? Math.ceil(count / ADMIN_PAGE_SIZE) : 1;

  return (
    <div className="admin-page">
      <div className="admin-container">
        <div className="flex justify-between items-center mb-7">
          <div>
            <h1 className="admin-page-title">Route Fare Templates</h1>
            <p className="admin-page-subtitle">
              {count} base cabin class fare templates across flight routes
            </p>
          </div>
          <button className="btn-primary" onClick={openCreate} id="add-fare-template-btn">
            <Plus size={15} /> Add Template
          </button>
        </div>

        {/* Filters & Search Toolbar */}
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setActiveSearch(search);
              setPage(1);
            }}
            className="flex gap-2 flex-grow max-w-md"
          >
            <div className="admin-toolbar-search flex-grow">
              <Search size={14} className="search-icon" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search flight no, airline, cabin..."
              />
            </div>
            <button type="submit" className="btn-primary">Search</button>
          </form>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="w-56">
              <Select
                id="filter-route"
                options={filterRouteOptions}
                value={selectedRouteFilter}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedRouteFilter(val);
                  if (val) setSearchParams({ route: val });
                  else setSearchParams({});
                  setPage(1);
                }}
              />
            </div>

            <div className="w-40">
              <Select
                id="filter-cabin"
                options={filterCabinOptions}
                value={selectedCabinFilter}
                onChange={(e) => {
                  setSelectedCabinFilter(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="admin-error">
            <AlertCircle size={16} />
            <span>{typeof error === 'string' ? error : JSON.stringify(error)}</span>
          </div>
        )}

        {/* Templates Table */}
        <div className="admin-card admin-table-wrap">
          {loading ? (
            <SpinnerLoader />
          ) : templates?.length === 0 ? (
            <div className="admin-empty">
              <div className="admin-empty-icon"><Tag size={28} /></div>
              <h3>No fare templates found</h3>
              <p>Create route-level fare class templates to enable automatic flight pricing.</p>
              <button className="btn-primary" onClick={openCreate}><Plus size={14} /> Add Template</button>
            </div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Flight Route</th>
                  <th>Cabin Class</th>
                  <th>Base Price</th>
                  <th>Included Baggage</th>
                  <th>Refund Type</th>
                  <th>Change Fee</th>
                  <th>Meal</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((t) => (
                  <tr key={t.id} className="admin-row">
                    <td>
                      <div className="flex flex-col">
                        <strong className="text-sm text-slate-900 font-bold">
                          {t.flight_no ? `Flight ${t.flight_no}` : `Route #${t.route}`}
                        </strong>
                        {t.airline_name && (
                          <span className="text-xs text-slate-500 font-medium">
                            {t.airline_name}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                        t.cabin_class === 'FIRST' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                        t.cabin_class === 'BUSINESS' ? 'bg-purple-100 text-purple-800 border border-purple-300' :
                        'bg-blue-100 text-blue-800 border border-blue-300'
                      }`}>
                        {t.cabin_class}
                      </span>
                    </td>
                    <td>
                      <strong className="text-emerald-700 font-semibold text-sm">
                        {t.currency || 'INR'} {Number(t.base_price).toLocaleString('en-IN')}
                      </strong>
                    </td>
                    <td>
                      <span className="text-xs text-slate-700 font-medium">
                        {t.baggage_weight_allowed_kg ?? 15} kg
                      </span>
                    </td>
                    <td>
                      <span className="text-xs text-slate-600 font-medium capitalize">
                        {t.refund_type?.replace('_', ' ').toLowerCase()}
                      </span>
                    </td>
                    <td>
                      <span className="text-xs text-slate-600 font-medium">
                        {t.currency || 'INR'} {Number(t.change_fee).toLocaleString('en-IN')}
                      </span>
                    </td>
                    <td>
                      {t.meal_included ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          <Check size={13} /> Included
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400 font-medium">—</span>
                      )}
                    </td>
                    <td className="text-right whitespace-nowrap">
                      <div className="flex gap-1.5 items-center justify-end">
                        <button
                          className="btn-secondary"
                          title="Adjust Price & Reprice Future Unsold Fares"
                          onClick={() => openRepriceModal(t)}
                          style={{ padding: '5px 9px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <RefreshCw size={12} className="text-amber-700" />
                          <span>Reprice</span>
                        </button>

                        <button
                          className="btn-secondary"
                          title="Edit Template"
                          onClick={() => openEdit(t)}
                          style={{ padding: '6px 8px' }}
                        >
                          <Pencil size={14} />
                        </button>

                        <button
                          className="btn-danger"
                          title="Delete Template"
                          onClick={() => setDeleteItem(t)}
                          style={{ padding: '6px 8px' }}
                        >
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
          totalPages={totalPages}
          totalCount={count || templates?.length || 0}
          pageSize={ADMIN_PAGE_SIZE}
          onPageChange={(p) => setPage(p)}
          entityLabel="templates"
        />
      </div>

      {/* Template Form Modal */}
      {showForm && (
        <div className="admin-modal-overlay" onClick={closeForm}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="admin-modal-header">
              <h2 className="admin-modal-title">
                {editId ? 'Edit Fare Template' : 'Add Route Fare Template'}
              </h2>
              <button className="btn-icon" onClick={closeForm}><X size={16} /></button>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 text-xs text-blue-900 flex gap-2">
              <Info size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                Each flight route supports <strong>strictly 1 fare template per cabin class</strong> (Economy, Business, First). Included baggage cannot be lower than the route baseline default (<strong>{minBaggageAllowed} kg</strong>).
              </div>
            </div>

            {validationErrors && (
              <div className="admin-error">
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  {typeof validationErrors === 'string' ? (
                    <span>{validationErrors}</span>
                  ) : (
                    Object.entries(validationErrors).map(([key, val]) => (
                      <div key={key}>
                        <strong className="capitalize">{key.replace('_', ' ')}:</strong> {Array.isArray(val) ? val.join(', ') : String(val)}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="admin-form-grid" style={{ marginBottom: 14 }}>
                <Select
                  id="route"
                  label="Flight Route"
                  options={routeOptions}
                  value={form.route}
                  disabled={!!editId}
                  onChange={(e) => {
                    const newRouteId = e.target.value;
                    const rObj = routes.find((r) => String(r.id) === String(newRouteId));
                    const routeBaggage = rObj?.baggage_weight_allowed_per_person
                      ? String(rObj.baggage_weight_allowed_per_person)
                      : '15';

                    setForm((f) => ({
                      ...f,
                      route: newRouteId,
                      baggage_weight_allowed_kg: Number(f.baggage_weight_allowed_kg) < Number(routeBaggage)
                        ? routeBaggage
                        : f.baggage_weight_allowed_kg,
                    }));
                  }}
                  error={localErrors.route}
                />

                <Select
                  id="cabin_class"
                  label="Cabin Class"
                  options={availableCabinOptions}
                  value={form.cabin_class}
                  disabled={!!editId}
                  onChange={(e) => setForm((f) => ({ ...f, cabin_class: e.target.value }))}
                  error={localErrors.cabin_class}
                />
              </div>

              <div className="admin-form-grid" style={{ marginBottom: 14 }}>
                <div>
                  <Input
                    id="base_price"
                    label="Base Price (INR)"
                    type="number"
                    min="0"
                    placeholder="e.g. 12000"
                    value={form.base_price}
                    onChange={(e) => setForm((f) => ({ ...f, base_price: e.target.value }))}
                    error={localErrors.base_price}
                  />
                  {editId && (
                    <span className="text-[11px] text-amber-700 font-medium block mt-1">
                      Updating price automatically reprices future unsold flight fares.
                    </span>
                  )}
                </div>

                <Select
                  id="refund_type"
                  label="Refund Type"
                  options={REFUND_OPTIONS}
                  value={form.refund_type}
                  onChange={(e) => setForm((f) => ({ ...f, refund_type: e.target.value }))}
                  error={localErrors.refund_type}
                />
              </div>

              <div className="admin-form-grid" style={{ marginBottom: 14 }}>
                <div>
                  <Input
                    id="change_fee"
                    label="Ticket Change Fee (INR)"
                    type="number"
                    min="0"
                    placeholder="0"
                    value={form.change_fee}
                    onChange={(e) => setForm((f) => ({ ...f, change_fee: e.target.value }))}
                    error={localErrors.change_fee}
                  />
                  <span className="text-[11px] text-slate-500 block mt-1">
                    Fee charged for changing flight date (0 for free date changes).
                  </span>
                </div>

                <div>
                  <Input
                    id="baggage_weight_allowed_kg"
                    label="Included Checked Baggage (kg)"
                    type="number"
                    min={minBaggageAllowed}
                    placeholder={`Min ${minBaggageAllowed} kg`}
                    value={form.baggage_weight_allowed_kg}
                    onChange={(e) => setForm((f) => ({ ...f, baggage_weight_allowed_kg: e.target.value }))}
                    error={localErrors.baggage_weight_allowed_kg}
                  />
                  <span className="text-[11px] text-slate-500 block mt-1">
                    Minimum allowed: <strong>{minBaggageAllowed} kg</strong> (Route default limit).
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 mb-5 pt-2">
                <input
                  type="checkbox"
                  id="meal_included"
                  checked={form.meal_included}
                  onChange={(e) => setForm((f) => ({ ...f, meal_included: e.target.checked }))}
                  className="w-4 h-4 rounded text-[#705d00] focus:ring-[#705d00]"
                />
                <label htmlFor="meal_included" className="text-sm font-semibold text-slate-700 cursor-pointer">
                  Complimentary Meal Included
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-5 border-t border-slate-200">
                <button type="button" className="btn-secondary" onClick={closeForm}>
                  <X size={14} /> Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={actionLoading}>
                  <Save size={14} /> {actionLoading ? 'Saving...' : 'Save Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Atomic Repricing Modal */}
      {repriceItem && (
        <div className="admin-modal-overlay" onClick={() => setRepriceItem(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div className="admin-modal-header">
              <h2 className="admin-modal-title flex items-center gap-2 text-amber-800">
                <RefreshCw size={18} /> Update Base Price & Bulk Reprice
              </h2>
              <button className="btn-icon" onClick={() => setRepriceItem(null)}><X size={16} /></button>
            </div>

            <form onSubmit={handleRepriceSubmit}>
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 mb-5 text-xs text-amber-900 leading-relaxed">
                <strong>Important Notice:</strong> Updating this base price template will update the master route price and automatically reprice all future <strong>unsold instance fares</strong> for <strong>{repriceItem.flight_no ? `Flight ${repriceItem.flight_no}` : `Route #${repriceItem.route}`} ({repriceItem.cabin_class})</strong>.
                Booked passenger tickets will remain completely unchanged.
              </div>

              <div className="flex flex-col gap-4 mb-6">
                <div className="flex items-center justify-between text-sm py-2 px-3 bg-slate-100 rounded-xl">
                  <span className="text-slate-600 font-semibold">Current Base Price:</span>
                  <strong className="text-slate-800 font-mono">
                    {repriceItem.currency || 'INR'} {Number(repriceItem.base_price).toLocaleString('en-IN')}
                  </strong>
                </div>

                <Input
                  id="new_base_price"
                  label="New Base Price"
                  type="number"
                  min="0"
                  placeholder="Enter new price..."
                  value={newBasePrice}
                  onChange={(e) => setNewBasePrice(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setRepriceItem(null)}
                  disabled={repriceLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary bg-amber-700 hover:bg-amber-800"
                  disabled={repriceLoading}
                >
                  <DollarSign size={14} />
                  {repriceLoading ? 'Repricing Future Fares...' : 'Confirm Reprice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      <DeleteConfirmationModal
        isOpen={deleteItem !== null}
        loading={deleteLoading}
        title="Delete Fare Template"
        message="Are you sure you want to delete this route fare template?"
        details={deleteItem ? {
          'FLIGHT ROUTE': deleteItem.flight_no ? `Flight ${deleteItem.flight_no}` : `Route #${deleteItem.route}`,
          'CABIN CLASS': deleteItem.cabin_class,
          'BASE PRICE': `${deleteItem.currency || 'INR'} ${deleteItem.base_price}`,
        } : null}
        onClose={() => setDeleteItem(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
