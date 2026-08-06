/**
 * AdminCrudPage — shared list + form page for all new entity CRUD screens.
 */
import { useEffect, useState, useMemo, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import DateTimePicker from '@/components/ui/DateTimePicker';
import { Pagination } from '@/components/ui/Pagination';
import { AlertCircle, Plus, Pencil, Trash2, Save, X, ChevronLeft, ChevronRight, Search, Inbox, AlertTriangle, ArrowLeft, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import '@/admin/_core/styles/admin.css';
import DeleteConfirmationModal from './DeleteConfirmationModal';

export default function AdminCrudPage({
  title,
  subtitle,
  breadcrumb, // Array of { label, href }
  entityName,
  columns,
  fields,
  emptyForm,
  validateForm,
  onBeforeSubmit,
  thunks,
  extraActions,
  filterBar,
  pageActions,
  banner,
  saveAndNextUrl,
}) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const state = useSelector((s) => s[entityName]);
  const { items, loading, actionLoading, error, validationErrors } = state || {};

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [localErrors, setLocalErrors] = useState({});
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [deleteItem, setDeleteItem] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const isDeletingRef = useRef(false);
  const PAGE_SIZE = 10;

  const loadList = (searchVal, pg) => {
    dispatch(thunks.fetchList({ search: searchVal, page: pg, page_size: PAGE_SIZE }));
  };

  useEffect(() => { loadList(search, page); }, []);

  const openCreate = () => {
    setEditId(null);
    setForm(emptyForm);
    setLocalErrors({});
    setShowForm(true);
  };

  const autoOpenedRef = useRef(false);
  useEffect(() => {
    const inFlow = searchParams.get('inFlow') === '1';
    if (inFlow && !autoOpenedRef.current) {
      autoOpenedRef.current = true;
      openCreate();
    }
  }, [searchParams]);


  const openEdit = (item) => {
    setEditId(item.id);
    const f = {};
    fields.forEach(({ name }) => { f[name] = item[name] ?? ''; });
    setForm(f);
    setLocalErrors({});
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditId(null);
    setForm(emptyForm);
    setLocalErrors({});
  };

  const handleChange = (e) => {
    const { name, value, type, checked, files } = e.target;
    const fieldConfig = fields.find((f) => f.name === name);
    let val = type === 'checkbox' ? checked : type === 'file' ? files[0] : value;
    if (fieldConfig?.autoUpper && typeof val === 'string') val = val.toUpperCase().trim();
    setForm((prev) => ({ ...prev, [name]: val }));
    if (localErrors[name]) setLocalErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleDateChange = (name, iso) => {
    setForm((prev) => ({ ...prev, [name]: iso }));
    if (localErrors[name]) setLocalErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleSubmit = async (e, goNext = false) => {
    if (e && e.preventDefault) e.preventDefault();
    const errors = validateForm ? validateForm(form) : {};
    if (Object.keys(errors).length > 0) {
      setLocalErrors(errors);
      toast.error('Please fix the validation errors.');
      return;
    }

    const payload = onBeforeSubmit ? onBeforeSubmit(form) : form;
    let promise;
    if (editId) {
      promise = dispatch(thunks.update({ id: editId, data: payload })).unwrap();
    } else {
      promise = dispatch(thunks.add(payload)).unwrap();
    }

    try {
      await promise;
      closeForm();
      loadList(search, page);
      toast.success(`${title} saved successfully!`);
      if (goNext && saveAndNextUrl) {
        navigate(saveAndNextUrl);
      }
    } catch (err) {
      if (err && typeof err === 'object' && !err.non_field_errors) {
        toast.error('Validation failed. Please check form fields.');
      } else {
        toast.error(err?.non_field_errors?.[0] || `Failed to save ${title}.`);
      }
    }
  };

  const getDeleteDetails = (item) => {
    if (!item) return null;
    const details = {};

    // 1. Fares
    if (entityName === 'fare' || item.fare_code) {
      if (item.fare_code) details['FARE CODE'] = item.fare_code;
      if (item.cabin_class) details['CABIN CLASS'] = item.cabin_class;
      if (item.price !== undefined && item.price !== null) details['PRICE'] = `${item.currency || 'INR'} ${item.price}`;
      return details;
    }

    // 2. Flight Routes
    if (entityName === 'flightRoute' || (item.flight_no && !item.date)) {
      if (item.flight_no) details['FLIGHT NO'] = item.flight_no;
      if (item.airline_name) details['AIRLINE'] = item.airline_name;
      return details;
    }

    // 3. Flight Instances
    if (entityName === 'flightInstance' || (item.flight_no && item.date)) {
      if (item.flight_no) details['FLIGHT NO'] = item.flight_no;
      if (item.date) details['DATE'] = item.date;
      if (item.status) details['STATUS'] = item.status;
      return details;
    }

    // 4. Seats
    if (entityName === 'seat' || item.seat_number) {
      if (item.seat_number) details['SEAT NUMBER'] = item.seat_number;
      if (item.seat_class) details['CABIN CLASS'] = item.seat_class;
      if (item.seat_fee !== undefined) details['SEAT FEE'] = `${item.currency || 'INR'} ${item.seat_fee}`;
      return details;
    }

    // 5. Food Items
    if (entityName === 'foodItem' || item.is_veg !== undefined || item.image_url) {
      if (item.name || item.item_name) details['ITEM NAME'] = item.name || item.item_name;
      if (item.airline_name) details['AIRLINE'] = item.airline_name;
      if (item.price !== undefined && item.price !== null) details['PRICE'] = `${item.currency || 'INR'} ${item.price}`;
      return details;
    }

    // 6. Aircraft
    if (item.registration) {
      details['REGISTRATION'] = item.registration;
      if (item.airline_name) details['AIRLINE'] = item.airline_name;
      if (item.model_display || item.aircraft_model_name) details['MODEL'] = item.model_display || item.aircraft_model_name;
      return details;
    }
    // 7. Airports
    else if (item.iata_code) {
      details['AIRPORT NAME'] = item.airport_name || item.name;
      details['IATA CODE'] = item.iata_code;
      if (item.city) details['CITY'] = item.city;
      if (item.country_name) details['COUNTRY'] = item.country_name;
      return details;
    }
    // 8. Airlines
    else if (item.iata_airline_code) {
      details['AIRLINE NAME'] = item.airline_name || item.name;
      details['IATA CODE'] = item.iata_airline_code;
      if (item.country_name || item.country) details['COUNTRY'] = item.country_name || item.country;
      return details;
    }
    // 9. Aircraft Models
    else if (item.manufacturer || item.model_name) {
      if (item.manufacturer) details['MANUFACTURER'] = item.manufacturer;
      if (item.model_name) details['MODEL NAME'] = item.model_name;
      return details;
    }
    // 10. Countries
    else if (item.name && (item.code || item.iso_code || item.country_code)) {
      details['COUNTRY NAME'] = item.name;
      details['COUNTRY CODE'] = item.code || item.iso_code || item.country_code;
      return details;
    }
    // 11. General fallback for any other entity
    else {
      const nameVal = item.name || item.title || item.code || item.flight_no || item.id;
      if (nameVal) details['NAME'] = String(nameVal);

      for (const [k, v] of Object.entries(item)) {
        if (
          !['id', 'created_at', 'updated_at', 'deleted_at'].includes(k) &&
          (typeof v === 'string' || typeof v === 'number') &&
          String(v).trim().length > 0 &&
          Object.keys(details).length < 4
        ) {
          const label = k.replace(/_/g, ' ').toUpperCase();
          if (!details[label]) {
            details[label] = String(v);
          }
        }
      }
    }

    return details;
  };

  const getSingularTitle = (t) => {
    if (!t) return 'Item';
    if (t.endsWith('ies')) return t.slice(0, -3) + 'y';
    if (t.endsWith('Items')) return t.slice(0, -1);
    if (t.endsWith('s') && !t.endsWith('ss')) return t.slice(0, -1);
    return t;
  };

  const confirmDelete = async () => {
    if (!deleteItem || isDeletingRef.current) return;
    isDeletingRef.current = true;
    setDeleteLoading(true);
    const singular = getSingularTitle(title);
    try {
      await dispatch(thunks.remove(deleteItem.id)).unwrap();
      toast.success(`${singular} deleted successfully.`);
      setDeleteItem(null);
      loadList(search, page);
    } catch (err) {
      const errorMsg = typeof err === 'string' ? err : (err?.detail || err?.message || err?.error || `Failed to delete ${singular.toLowerCase()}.`);
      toast.error(errorMsg);
    } finally {
      setDeleteLoading(false);
      isDeletingRef.current = false;
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    loadList(search, 1);
  };

  const handlePage = (next) => {
    setPage(next);
    loadList(search, next);
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const sortedItems = useMemo(() => {
    if (!items) return [];
    if (!sortConfig.key) return items;
    return [...items].sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [items, sortConfig]);

  const totalPages = state?.count ? Math.ceil(state.count / PAGE_SIZE) : 1;

  return (
    <div className="admin-page">
      <div className="admin-container">

        {breadcrumb && breadcrumb.length > 0 && (
          <div className="admin-breadcrumb">
            {breadcrumb.map((b, i) => (
              <span key={i}>
                {b.href ? <Link to={b.href}>{b.label}</Link> : <span>{b.label}</span>}
                {i < breadcrumb.length - 1 && <span className="mx-2">/</span>}
              </span>
            ))}
          </div>
        )}

        {/* Header */}
        <div className="admin-page-header">
          <div className="flex items-center gap-3">
            {breadcrumb && breadcrumb.length > 0 && (
              <button
                onClick={() => {
                  const fromPage = searchParams.get('fromPage');
                  const instance = searchParams.get('instance');
                  if (fromPage && instance && breadcrumb && breadcrumb[0] && breadcrumb[0].href) {
                    navigate(`${breadcrumb[0].href}?page=${fromPage}&highlightInstance=${instance}`);
                  } else {
                    navigate(-1);
                  }
                }}
                className="flex items-center gap-1.5 bg-black/5 border-none rounded-lg px-[13px] py-[7px] text-[13px] font-semibold text-[#555] cursor-pointer transition-colors duration-200 flex-shrink-0 hover:bg-black/10"
              >
                <ArrowLeft size={15} /> Back
              </button>
            )}
            <div>
              <h1 className="admin-page-title">{title}</h1>
              {subtitle && <p className="admin-page-subtitle">{subtitle}</p>}
              {!subtitle && state?.count !== undefined && (
                <p className="admin-page-subtitle">{state.count} total records found</p>
              )}
            </div>
          </div>
          <div className="flex gap-2.5 items-center">
            {pageActions}
            <button className="btn-primary" onClick={openCreate} id={`add-${entityName}-btn`}>
              <Plus size={15} /> Add New
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="admin-toolbar">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="admin-toolbar-search">
              <Search size={14} className="search-icon" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search ${title.toLowerCase()}…`}
              />
              {search && (
                <button
                  type="button"
                  className="clear-search-btn"
                  onClick={() => { setSearch(''); setPage(1); loadList('', 1); }}
                  title="Clear search"
                >
                  <X size={13} />
                </button>
              )}
            </div>
            <button type="submit" className="btn-secondary px-[14px] py-[7px] text-[13px]">Search</button>
          </form>
          {filterBar}
        </div>

        {/* Table Card */}
        <div className="admin-card admin-table-wrap">
          {loading && !items?.length ? (
            <div className="p-4">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="skeleton-row">
                  <div className="skeleton h-5 w-1/4" />
                  <div className="skeleton h-5 w-[35%]" />
                  <div className="skeleton h-5 w-[15%]" />
                </div>
              ))}
            </div>
          ) : items?.length === 0 ? (
            <div className="admin-empty">
              <div className="admin-empty-icon"><Inbox size={28} /></div>
              <h3>No {title.toLowerCase()} found</h3>
              <p>Get started by creating a new record or adjust your search.</p>
              <button className="btn-primary" onClick={openCreate}>
                <Plus size={14} /> Create {title}
              </button>
            </div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      className={`${sortConfig.key === col.key ? 'sorted' : ''} ${col.className || ''}`}
                    >
                      {col.label}
                      {sortConfig.key === col.key && (
                        <span className="sort-icon">{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>
                      )}
                    </th>
                  ))}
                  <th className="w-[100px] text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedItems.map((item) => (
                  <tr key={item.id}>
                    {columns.map((col) => (
                      <td key={col.key} className={col.className || ''}>
                        {col.render ? col.render(item) : item[col.key] ?? '—'}
                      </td>
                    ))}
                    <td className="text-right whitespace-nowrap">
                      <div className="flex gap-1.5 items-center justify-end">
                        <button className="btn-secondary" onClick={() => openEdit(item)} title="Edit" style={{ padding: '6px 8px' }}>
                          <Pencil size={14} />
                        </button>
                        <button className="btn-danger" onClick={() => setDeleteItem(item)} title="Delete" style={{ padding: '6px 8px' }}>
                          <Trash2 size={14} />
                        </button>
                        {extraActions && extraActions(item)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalCount={state?.count || items?.length || 0}
          pageSize={PAGE_SIZE}
          onPageChange={handlePage}
          entityLabel={title.toLowerCase()}
        />
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="admin-modal-overlay" onClick={closeForm}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2 className="admin-modal-title">{editId ? `Edit ${title}` : `Add ${title}`}</h2>
              <button className="btn-icon" onClick={closeForm}><X size={18} /></button>
            </div>
            {banner && <div className="mb-4">{banner}</div>}

            {validationErrors?.non_field_errors && (
              <div className="admin-error">
                <AlertCircle size={15} />
                <span>{validationErrors.non_field_errors.join(', ')}</span>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="admin-form-grid">
                {fields.map((field) => {
                  const errorMsg = validationErrors?.[field.name]?.[0] || localErrors[field.name];

                  if (field.type === 'select') {
                    return (
                      <div key={field.name} className={field.fullWidth ? 'admin-form-full' : ''}>
                        <Select
                          id={field.name} label={field.label} options={field.options || []}
                          value={form[field.name] ?? ''} onChange={handleChange} error={errorMsg}
                        />
                      </div>
                    );
                  }
                  if (field.type === 'datetime') {
                    return (
                      <div key={field.name} className={field.fullWidth ? 'admin-form-full' : ''}>
                        <label className="text-[11px] font-bold tracking-[0.06em] uppercase text-[#5e5e5e] block mb-1.5">
                          {field.label}
                        </label>
                        <DateTimePicker value={form[field.name] ?? ''} onChange={(e) => handleDateChange(field.name, e.target.value)} />
                        {errorMsg && <p className="text-xs text-[#dc2626] mt-1">{errorMsg}</p>}
                      </div>
                    );
                  }
                  if (field.type === 'checkbox') {
                    return (
                      <div key={field.name} className={`flex items-center gap-2.5 pt-6 ${field.fullWidth ? 'admin-form-full' : ''}`}>
                        <input type="checkbox" id={field.name} name={field.name} checked={!!form[field.name]} onChange={handleChange} className="w-4 h-4 accent-admin-accent-dark" />
                        <label htmlFor={field.name} className="text-[13px] font-semibold text-[#1a1c1d] cursor-pointer">{field.label}</label>
                      </div>
                    );
                  }
                  if (field.type === 'file') {
                    return (
                      <FileUploadBox
                        key={field.name}
                        field={field}
                        value={form[field.name]}
                        onChange={handleChange}
                        errorMsg={errorMsg}
                        existingUrl={form.image_url || form.logo_url}
                      />
                    );
                  }
                  if (field.type === 'textarea') {
                    return (
                      <div key={field.name} className="admin-form-full">
                        <label className="text-[11px] font-bold tracking-[0.06em] uppercase text-[#5e5e5e] block mb-1.5">
                          {field.label}
                        </label>
                        <textarea name={field.name} value={form[field.name] ?? ''} onChange={handleChange} rows={3} className="w-full px-3 py-[9px] rounded-admin-sm border border-black/15 text-[13px] resize-y outline-none" />
                        {errorMsg && <p className="text-xs text-[#dc2626] mt-1">{errorMsg}</p>}
                      </div>
                    );
                  }
                  if (field.type === 'string-array') {
                    const arr = Array.isArray(form[field.name]) ? form[field.name] : [];
                    return (
                      <div key={field.name} className={field.fullWidth ? 'admin-form-full' : ''}>
                        <div className="flex justify-between items-center mb-1.5">
                          <label className="text-[11px] font-bold tracking-[0.06em] uppercase text-[#5e5e5e]">
                            {field.label}
                          </label>
                          <button type="button" onClick={() => setForm(f => ({ ...f, [field.name]: [...arr, ''] }))} className="text-[11px] font-bold text-admin-accent-dark bg-transparent border-none cursor-pointer flex items-center gap-1">
                            <Plus size={12} /> Add
                          </button>
                        </div>
                        {arr.length === 0 && <p className="text-xs text-[#888] mt-1 mb-2">No items added.</p>}
                        {arr.map((val, idx) => (
                          <div key={idx} className="flex gap-2 mb-2 items-center">
                            <div className="flex-1">
                              <Input
                                value={val}
                                placeholder={field.placeholder || ''}
                                onChange={(e) => {
                                  const newArr = [...arr];
                                  newArr[idx] = e.target.value;
                                  setForm(f => ({ ...f, [field.name]: newArr }));
                                }}
                              />
                            </div>
                            <button type="button" onClick={() => {
                              const newArr = arr.filter((_, i) => i !== idx);
                              setForm(f => ({ ...f, [field.name]: newArr }));
                            }} className="bg-transparent border-none text-[#dc2626] cursor-pointer p-1">
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                        {errorMsg && <p className="text-xs text-[#dc2626] mt-1">{errorMsg}</p>}
                      </div>
                    );
                  }
                  return (
                    <div key={field.name} className={field.fullWidth ? 'admin-form-full' : ''}>
                      <Input
                        id={field.name} type={field.type || 'text'} label={field.label} placeholder={field.placeholder || ''}
                        value={form[field.name] ?? ''}
                        onChange={field.autoUpper ? (e) => { const evt = { target: { name: field.name, value: e.target.value.toUpperCase().trim() } }; handleChange(evt); } : handleChange}
                        disabled={field.readOnly && !!editId} error={errorMsg}
                      />
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-end gap-2.5 mt-8">
                <button type="button" className="btn-secondary" onClick={closeForm}>Cancel</button>
                <button type="submit" className="btn-secondary" disabled={actionLoading} onClick={(e) => handleSubmit(e, false)}>
                  <Save size={14} /> {actionLoading ? 'Saving…' : 'Save'}
                </button>
                {saveAndNextUrl && (
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={(e) => handleSubmit(e, true)}
                    className="px-4 py-2 rounded-xl bg-[#705d00] hover:bg-[#5a4b00] text-white font-bold text-xs flex items-center gap-1.5 shadow-md cursor-pointer transition-all border-none"
                  >
                    Save & Next <ChevronRight size={14} />
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {(() => {
        const singular = title.endsWith('ies')
          ? title.slice(0, -3) + 'y'
          : title.endsWith('Items')
          ? title.slice(0, -1)
          : (title.endsWith('s') && !title.endsWith('ss') ? title.slice(0, -1) : title);
        return (
          <DeleteConfirmationModal
            isOpen={deleteItem !== null}
            loading={deleteLoading}
            title={`Delete ${singular}`}
            message={`Are you sure you want to delete this ${singular.toLowerCase()}?`}
            details={getDeleteDetails(deleteItem)}
            onClose={() => setDeleteItem(null)}
            onConfirm={confirmDelete}
          />
        );
      })()}
    </div>
  );
}

function FileUploadBox({ field, value, onChange, errorMsg, existingUrl }) {
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (value instanceof File) {
      const url = URL.createObjectURL(value);
      setPreview(url);
      return () => URL.revokeObjectURL(url);
    } else if (typeof value === 'string' && value) {
      setPreview(value);
    } else if (existingUrl) {
      setPreview(existingUrl);
    } else {
      setPreview(null);
    }
  }, [value, existingUrl]);

  return (
    <div className="admin-form-full">
      <label className="text-[11px] font-bold tracking-[0.06em] uppercase text-[#5e5e5e] block mb-1.5 text-center">
        {field.label}
      </label>

      <label className="relative flex flex-col items-center justify-center w-full min-h-[120px] p-4 border-2 border-dashed border-slate-300 hover:border-amber-500 hover:bg-amber-50/20 rounded-2xl cursor-pointer transition-all group bg-slate-50/50 text-center">
        <input
          type="file"
          name={field.name}
          accept="image/*"
          onChange={onChange}
          className="hidden"
        />

        {preview ? (
          <div className="flex flex-col items-center justify-center gap-2 text-center w-full">
            <div className="w-16 h-16 rounded-xl overflow-hidden shadow-sm border border-slate-200 bg-white flex items-center justify-center">
              <img src={preview} alt="Preview" className="w-full h-full object-contain p-1" />
            </div>
            <div className="min-w-0 text-center">
              <span className="text-xs font-bold text-slate-800 block truncate max-w-[240px] mx-auto">
                {value instanceof File ? value.name : 'Image Uploaded'}
              </span>
              <span className="text-[11px] font-semibold text-amber-700 group-hover:underline block mt-0.5">
                Click to change image
              </span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-1.5 text-center">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-700 group-hover:bg-amber-500 group-hover:text-white flex items-center justify-center transition-all shadow-sm">
              <Upload size={18} />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-800 group-hover:text-amber-700 transition-colors block">
                Click or drop image to upload
              </span>
              <span className="text-[11px] text-slate-400 block mt-0.5">
                PNG, JPG, WEBP or SVG (Max 5MB)
              </span>
            </div>
          </div>
        )}
      </label>

      {errorMsg && <p className="text-xs text-[#dc2626] mt-1 text-center">{errorMsg}</p>}
    </div>
  );
}