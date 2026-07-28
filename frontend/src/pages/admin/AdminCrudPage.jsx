/**
 * AdminCrudPage — shared list + form page for all new entity CRUD screens.
 */
import { useEffect, useState, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import DateTimePicker from '@/components/ui/DateTimePicker';
import { AlertCircle, Plus, Pencil, Trash2, Save, X, ChevronLeft, ChevronRight, Search, Inbox, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import '@/styles/admin-system.css';

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
}) {
  const dispatch = useDispatch();
  const state = useSelector((s) => s[entityName]);
  const { items, loading, actionLoading, error, validationErrors } = state || {};

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [localErrors, setLocalErrors] = useState({});
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const PAGE_SIZE = 20;

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

  const handleSubmit = async (e) => {
    e.preventDefault();
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

    toast.promise(promise, {
      loading: editId ? `Updating ${title}…` : `Creating ${title}…`,
      success: () => {
        closeForm();
        loadList(search, page);
        return `${title} saved successfully!`;
      },
      error: (err) => {
        if (err && typeof err === 'object' && !err.non_field_errors) {
          return 'Validation failed. Please check form fields.';
        }
        return err?.non_field_errors?.[0] || `Failed to save ${title}.`;
      },
    });
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
        
        {breadcrumb && breadcrumb.length > 0 && (
          <div className="admin-breadcrumb">
            {breadcrumb.map((b, i) => (
              <span key={i}>
                {b.href ? <Link to={b.href}>{b.label}</Link> : <span>{b.label}</span>}
                {i < breadcrumb.length - 1 && <span style={{ margin: '0 8px' }}>/</span>}
              </span>
            ))}
          </div>
        )}

        {/* Header */}
        <div className="admin-page-header">
          <div>
            <h1 className="admin-page-title">{title}</h1>
            {subtitle && <p className="admin-page-subtitle">{subtitle}</p>}
            {!subtitle && state?.count !== undefined && (
              <p className="admin-page-subtitle">{state.count} total records found</p>
            )}
          </div>
          <button className="btn-primary" onClick={openCreate} id={`add-${entityName}-btn`}>
            <Plus size={15} /> Add New
          </button>
        </div>

        {/* Toolbar */}
        <div className="admin-toolbar">
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, flex: 1, maxWidth: 400 }}>
            <div className="admin-toolbar-search">
              <Search size={14} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search ${title.toLowerCase()}…`}
              />
            </div>
            <button type="submit" className="btn-secondary">Search</button>
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
            <div style={{ padding: 16 }}>
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="skeleton-row">
                  <div className="skeleton" style={{ height: 20, width: '25%' }} />
                  <div className="skeleton" style={{ height: 20, width: '35%' }} />
                  <div className="skeleton" style={{ height: 20, width: '15%' }} />
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
                  <th style={{ width: 120 }}>Actions</th>
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
                    <td>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
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
        {totalPages > 1 && (
          <div className="admin-pagination">
            <button className="btn-secondary" disabled={page === 1} onClick={() => handlePage(page - 1)}>
              <ChevronLeft size={15} /> Prev
            </button>
            <span className="admin-pagination-info">Page {page} of {totalPages}</span>
            <button className="btn-secondary" disabled={page === totalPages} onClick={() => handlePage(page + 1)}>
              Next <ChevronRight size={15} />
            </button>
          </div>
        )}
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
                        <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#5e5e5e', display: 'block', marginBottom: 6 }}>
                          {field.label}
                        </label>
                        <DateTimePicker value={form[field.name] ?? ''} onChange={(e) => handleDateChange(field.name, e.target.value)} />
                        {errorMsg && <p style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>{errorMsg}</p>}
                      </div>
                    );
                  }
                  if (field.type === 'checkbox') {
                    return (
                      <div key={field.name} style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 24 }} className={field.fullWidth ? 'admin-form-full' : ''}>
                        <input type="checkbox" id={field.name} name={field.name} checked={!!form[field.name]} onChange={handleChange} style={{ width: 16, height: 16, accentColor: 'var(--admin-accent-dark)' }} />
                        <label htmlFor={field.name} style={{ fontSize: 13, fontWeight: 600, color: '#1a1c1d', cursor: 'pointer' }}>{field.label}</label>
                      </div>
                    );
                  }
                  if (field.type === 'file') {
                    return (
                      <div key={field.name} className={field.fullWidth ? 'admin-form-full' : ''}>
                        <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#5e5e5e', display: 'block', marginBottom: 6 }}>
                          {field.label}
                        </label>
                        <input type="file" name={field.name} accept="image/*" onChange={handleChange} style={{ fontSize: 13 }} />
                        {errorMsg && <p style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>{errorMsg}</p>}
                      </div>
                    );
                  }
                  if (field.type === 'textarea') {
                    return (
                      <div key={field.name} className="admin-form-full">
                        <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#5e5e5e', display: 'block', marginBottom: 6 }}>
                          {field.label}
                        </label>
                        <textarea name={field.name} value={form[field.name] ?? ''} onChange={handleChange} rows={3} style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--admin-radius-sm)', border: '1px solid rgba(0,0,0,0.15)', fontSize: 13, resize: 'vertical', outline: 'none' }} />
                        {errorMsg && <p style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>{errorMsg}</p>}
                      </div>
                    );
                  }
                  if (field.type === 'string-array') {
                    const arr = Array.isArray(form[field.name]) ? form[field.name] : [];
                    return (
                      <div key={field.name} className={field.fullWidth ? 'admin-form-full' : ''}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#5e5e5e' }}>
                            {field.label}
                          </label>
                          <button type="button" onClick={() => setForm(f => ({ ...f, [field.name]: [...arr, ''] }))} style={{ fontSize: 11, fontWeight: 700, color: 'var(--admin-accent-dark)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Plus size={12} /> Add
                          </button>
                        </div>
                        {arr.length === 0 && <p style={{ fontSize: 12, color: '#888', margin: '4px 0 8px' }}>No items added.</p>}
                        {arr.map((val, idx) => (
                          <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                            <div style={{ flex: 1 }}>
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
                            }} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', padding: 4 }}>
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                        {errorMsg && <p style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>{errorMsg}</p>}
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

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 32 }}>
                <button type="button" className="btn-secondary" onClick={closeForm}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={actionLoading}>
                  <Save size={14} /> {actionLoading ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
