/**
 * AdminCrudPage — shared list + form page for all new entity CRUD screens.
 */
import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import DateTimePicker from '@/components/ui/DateTimePicker';
import { Pagination } from '@/components/ui/Pagination';
import { AlertCircle, Plus, Pencil, Trash2, Save, X, ChevronRight, Search, Inbox, ArrowLeft, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import '@/admin/_core/styles/admin.css';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import useDeleteAction from './hooks/useDeleteAction';
import { parseApiError } from '@/utils/errorUtils';


import PageLoader from '@/admin/_core/components/PageLoader';
import { ADMIN_PAGE_SIZE } from '@/admin/_core/store/adminSlices';

export default function AdminCrudPage({
  config,
  extraActions,
  filterBar,
  pageActions,
  banner,
  saveAndNextUrl,
}) {
  const {
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
    getDeleteDetails,
  } = config || {};
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const state = useSelector((s) => s[entityName]);
  const { items, loading, actionLoading, error: _error, validationErrors } = state || {};

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [localErrors, setLocalErrors] = useState({});
  const [search, setSearch] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [searchFocus, setSearchFocus] = useState(false);
  const [page, setPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  const loadList = useCallback((searchVal, pg) => {
    dispatch(thunks.fetchList({ search: searchVal, page: pg }));
  }, [dispatch, thunks]);

  useEffect(() => { loadList(activeSearch, page); }, [loadList, activeSearch, page]);

  const openCreate = useCallback(() => {
    setEditId(null);
    setForm(emptyForm);
    setLocalErrors({});
    setShowForm(true);
  }, [emptyForm]);

  const autoOpenedRef = useRef(false);
  useEffect(() => {
    const inFlow = searchParams.get('inFlow') === '1';
    if (inFlow && !autoOpenedRef.current) {
      autoOpenedRef.current = true;
      openCreate();
    }
  }, [searchParams, openCreate]);


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
      toast.error(parseApiError(err, `Failed to save ${title}.`));
    }
  };

  
  const getSingularTitle = (t) => {
    if (!t) return 'Item';
    if (t.endsWith('ies')) return t.slice(0, -3) + 'y';
    if (t.endsWith('Items')) return t.slice(0, -1);
    if (t.endsWith('s') && !t.endsWith('ss')) return t.slice(0, -1);
    return t;
  };

  const singular = getSingularTitle(title);
  const { deleteItem, setDeleteItem, deleteLoading, confirmDelete } = useDeleteAction({
    thunk: thunks.remove,
    onSuccess: () => loadList(search, page),
    successMessage: `${singular} deleted successfully.`,
    errorMessage: `Failed to delete ${singular.toLowerCase()}.`
  });

  const handleSearch = (e) => {
    e?.preventDefault();
    setActiveSearch(search);
    setPage(1);
    setSearchFocus(false);
  };

  const handlePage = (next) => {
    setPage(next);
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

  const searchSuggestions = useMemo(() => {
    if (!search || search.trim().length < 2 || !items) return [];
    const q = search.toLowerCase().trim();
    const suggestionsMap = new Map();
    
    items.forEach(item => {
      columns.forEach(col => {
        const val = item[col.key];
        if (typeof val === 'string' && val.toLowerCase().includes(q)) {
          if (!suggestionsMap.has(val)) {
            suggestionsMap.set(val, col.label || col.key);
          }
        }
      });
    });
    return Array.from(suggestionsMap.entries()).map(([value, category]) => ({ value, category })).slice(0, 5);
  }, [search, items, columns]);

  const totalPages = state?.count ? Math.ceil(state.count / ADMIN_PAGE_SIZE) : 1;

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
                className="flex items-center gap-1.5 bg-black/5 border-none rounded-lg px-[13px] py-[7px] text-[13px] font-semibold text-admin-muted cursor-pointer transition-colors duration-200 flex-shrink-0 hover:bg-black/10"
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
        {(!config.hideSearch || filterBar) && (
          <div className="admin-toolbar">
            {!config.hideSearch && (
              <form onSubmit={handleSearch} className="flex gap-2">
                <div className="admin-toolbar-search" style={{ position: 'relative' }}>
                  <Search size={14} className="search-icon" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onFocus={() => setSearchFocus(true)}
                    onBlur={() => setSearchFocus(false)}
                    placeholder={`Search ${title.toLowerCase()}…`}
                  />
                  {search && (
                    <button
                      type="button"
                      className="clear-search-btn"
                      onClick={() => { setSearch(''); setActiveSearch(''); setPage(1); }}
                      title="Clear search"
                    >
                      <X size={13} />
                    </button>
                  )}
                  {searchFocus && searchSuggestions.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000, background: '#fff', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 8, maxHeight: 180, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', marginTop: 4 }}>
                      {searchSuggestions.map((sug, idx) => (
                        <div
                          key={idx}
                          onMouseDown={(e) => {
                            e.preventDefault(); // Prevent blur
                            setSearch(sug.value);
                            setActiveSearch(sug.value);
                            setPage(1);
                            setSearchFocus(false);
                          }}
                          style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: idx < searchSuggestions.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(112,93,0,0.06)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <span style={{ fontWeight: 600, color: '#1a1c1d', fontSize: 13 }}>{sug.value}</span>
                          <span style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>{sug.category}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <button type="submit" className="btn-secondary px-[14px] py-[7px] text-[13px]">Search</button>
              </form>
            )}
            {filterBar}
          </div>
        )}

        {/* Table Card */}
        <div className="admin-card admin-table-wrap">
          {loading && !items?.length ? (
            <PageLoader label={`Loading ${title}...`} />
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
          pageSize={ADMIN_PAGE_SIZE}
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
                        <label className="text-[11px] font-bold tracking-[0.06em] uppercase text-admin-muted block mb-1.5">
                          {field.label}
                        </label>
                        <DateTimePicker value={form[field.name] ?? ''} onChange={(e) => handleDateChange(field.name, e.target.value)} />
                        {errorMsg && <p className="text-xs text-status-red mt-1">{errorMsg}</p>}
                      </div>
                    );
                  }
                  if (field.type === 'checkbox') {
                    return (
                      <div key={field.name} className={`flex items-center gap-2.5 pt-6 ${field.fullWidth ? 'admin-form-full' : ''}`}>
                        <input type="checkbox" id={field.name} name={field.name} checked={!!form[field.name]} onChange={handleChange} className="w-4 h-4 accent-admin-accent-dark" />
                        <label htmlFor={field.name} className="text-[13px] font-semibold text-admin-ink cursor-pointer">{field.label}</label>
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
                        <label className="text-[11px] font-bold tracking-[0.06em] uppercase text-admin-muted block mb-1.5">
                          {field.label}
                        </label>
                        <textarea name={field.name} value={form[field.name] ?? ''} onChange={handleChange} rows={3} className="w-full px-3 py-[9px] rounded-admin-sm border border-black/15 text-[13px] resize-y outline-none" />
                        {errorMsg && <p className="text-xs text-status-red mt-1">{errorMsg}</p>}
                      </div>
                    );
                  }
                  if (field.type === 'string-array') {
                    const arr = Array.isArray(form[field.name]) ? form[field.name] : [];
                    return (
                      <div key={field.name} className={field.fullWidth ? 'admin-form-full' : ''}>
                        <div className="flex justify-between items-center mb-1.5">
                          <label className="text-[11px] font-bold tracking-[0.06em] uppercase text-admin-muted">
                            {field.label}
                          </label>
                          <button type="button" onClick={() => setForm(f => ({ ...f, [field.name]: [...arr, ''] }))} className="text-[11px] font-bold text-admin-accent-dark bg-transparent border-none cursor-pointer flex items-center gap-1">
                            <Plus size={12} /> Add
                          </button>
                        </div>
                        {arr.length === 0 && <p className="text-xs text-admin-muted mt-1 mb-2">No items added.</p>}
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
                            }} className="bg-transparent border-none text-status-red cursor-pointer p-1">
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                        {errorMsg && <p className="text-xs text-status-red mt-1">{errorMsg}</p>}
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

              <div className="flex flex-wrap items-center justify-between gap-3 pt-6 border-t border-slate-200 mt-8">
                <button type="button" className="btn-secondary" onClick={closeForm}><X size={14} /> Cancel</button>

                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" className="btn-secondary" disabled={actionLoading} onClick={(e) => handleSubmit(e, false)}>
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
      <label className="text-[11px] font-bold tracking-[0.06em] uppercase text-admin-muted block mb-1.5 text-center">
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

      {errorMsg && <p className="text-xs text-status-red mt-1 text-center">{errorMsg}</p>}
    </div>
  );
}