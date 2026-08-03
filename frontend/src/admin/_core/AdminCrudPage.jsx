/**
 * AdminCrudPage — shared list + form page for all new entity CRUD screens.
 */
import { useEffect, useState, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import DateTimePicker from '@/components/ui/DateTimePicker';
import { Pagination } from '@/components/ui/Pagination';
import { AlertCircle, Plus, Pencil, Trash2, Save, X, ChevronLeft, ChevronRight, Search, Inbox, AlertTriangle, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import '@/admin/_core/styles/admin.css';

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
  const state = useSelector((s) => s[entityName]);
  const { items, loading, actionLoading, error, validationErrors } = state || {};

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [localErrors, setLocalErrors] = useState({});
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
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

  const handleDelete = async (id) => {
    if (!window.confirm(`Delete this ${title}? This action cannot be undone.`)) return;
    const promise = dispatch(thunks.remove(id)).unwrap();
    toast.promise(promise, {
      loading: 'Deleting…',
      success: `${title} deleted.`,
      error: 'Failed to delete.',
    });
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

        {banner}

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
                onClick={() => navigate(-1)}
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

        {/* Global error */}
        {error && (
          <div className="admin-error">
            <AlertTriangle size={16} />
            <span>{typeof error === 'string' ? error : JSON.stringify(error)}</span>
            <button onClick={() => loadList(search, page)}>Retry</button>
          </div>
        )}

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
                      className={sortConfig.key === col.key ? 'sorted' : ''}
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
                      <td key={col.key}>
                        {col.render ? col.render(item) : item[col.key] ?? '—'}
                      </td>
                    ))}
                    <td className="text-right whitespace-nowrap">
                      <div className="flex gap-1.5 items-center justify-end">
                        <button className="btn-icon" onClick={() => openEdit(item)} title="Edit">
                          <Pencil size={15} />
                        </button>
                        <button className="btn-icon danger" onClick={() => handleDelete(item.id)} title="Delete">
                          <Trash2 size={15} />
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
                      <div key={field.name} className={field.fullWidth ? 'admin-form-full' : ''}>
                        <label className="text-[11px] font-bold tracking-[0.06em] uppercase text-[#5e5e5e] block mb-1.5">
                          {field.label}
                        </label>
                        <input type="file" name={field.name} accept="image/*" onChange={handleChange} className="text-[13px]" />
                        {errorMsg && <p className="text-xs text-[#dc2626] mt-1">{errorMsg}</p>}
                      </div>
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
    </div>
  );
}