import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import AdminCrudPage from '../AdminCrudPage';
import { fetchCountries } from '@/store/adminSlices';
import {
  fetchAirports, fetchAirportDetail, addAirport, updateAirport, removeAirport,
  importOpenFlights,
} from '@/store/adminSlices';
import toast from 'react-hot-toast';
import { Download, RefreshCw, X } from 'lucide-react';

const COLUMNS = [
  { key: 'iata_code', label: 'IATA Code' },
  { key: 'airport_name', label: 'Airport Name' },
  { key: 'city', label: 'City' },
  { key: 'country_name', label: 'Country' },
  { key: 'terminals', label: 'Terminals', render: (r) => (r.terminals && r.terminals.length > 0 ? r.terminals.join(', ') : '—') },
];

const EMPTY_FORM = {
  iata_code: '', airport_name: '', city: '', timezone: 'UTC',
  latitude: '', longitude: '', country: '', terminals: [],
};

const validateForm = (form) => {
  const e = {};
  if (!form.iata_code || !/^[A-Za-z]{3}$/.test(form.iata_code.trim())) e.iata_code = 'IATA code must be exactly 3 alphabetic characters.';
  if (!form.airport_name || form.airport_name.trim().length < 3) e.airport_name = 'Airport name must be at least 3 characters.';
  if (!form.city || form.city.trim().length < 2) e.city = 'City name must be at least 2 characters.';
  if (!form.country) e.country = 'Country is required.';
  if (form.latitude !== '' && (Number(form.latitude) < -90 || Number(form.latitude) > 90)) e.latitude = 'Must be between -90 and 90.';
  if (form.longitude !== '' && (Number(form.longitude) < -180 || Number(form.longitude) > 180)) e.longitude = 'Must be between -180 and 180.';
  return e;
};

const THUNKS = { fetchList: fetchAirports, fetchDetail: fetchAirportDetail, add: addAirport, update: updateAirport, remove: removeAirport };

export default function AirportsPage() {
  const dispatch = useDispatch();
  const { items: countries } = useSelector((s) => s.country);
  
  const [showImportModal, setShowImportModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const [overwrite, setOverwrite] = useState(false);
  const [limit, setLimit] = useState('200');
  const [countryFilter, setCountryFilter] = useState('India');

  useEffect(() => { dispatch(fetchCountries({})); }, [dispatch]);

  const countryOptions = countries.map((c) => ({ value: c.id, label: `${c.name} (${c.iso_code})` }));

  const FIELDS = [
    { name: 'iata_code', label: 'IATA Code (3 chars)', placeholder: 'e.g. JFK', autoUpper: true },
    { name: 'airport_name', label: 'Airport Name', placeholder: 'e.g. John F. Kennedy International' },
    { name: 'city', label: 'City', placeholder: 'e.g. New York' },
    { name: 'country', label: 'Country', type: 'select', options: countryOptions },
    { name: 'timezone', label: 'Timezone', placeholder: 'e.g. America/New_York' },
    { name: 'latitude', label: 'Latitude', type: 'number', placeholder: 'e.g. 40.6413' },
    { name: 'longitude', label: 'Longitude', type: 'number', placeholder: 'e.g. -73.7781' },
    { name: 'terminals', label: 'Terminals', type: 'string-array', placeholder: 'e.g. T1' },
  ];

  const handleImportSubmit = async (e) => {
    e.preventDefault();
    setImporting(true);
    try {
      const params = {
        overwrite,
        limit: limit ? parseInt(limit, 10) : undefined,
        countries: countryFilter ? countryFilter.trim() : undefined,
      };

      const result = await dispatch(importOpenFlights(params)).unwrap();
      toast.success(result.detail || 'Airports imported successfully!');
      setShowImportModal(false);
      // reload lists
      dispatch(fetchAirports({ page: 1, page_size: 10 }));
    } catch (err) {
      toast.error(err || 'Failed to import airports.');
    } finally {
      setImporting(false);
    }
  };

  const pageActions = (
    <button 
      className="btn-secondary" 
      onClick={() => setShowImportModal(true)}
      style={{ display: 'flex', alignItems: 'center', gap: 6 }}
    >
      <Download size={15} />
      Import Airports
    </button>
  );

  return (
    <>
      <AdminCrudPage
        title="Airports"
        entityName="airport"
        columns={COLUMNS}
        fields={FIELDS}
        emptyForm={EMPTY_FORM}
        validateForm={validateForm}
        thunks={THUNKS}
        pageActions={pageActions}
      />

      {showImportModal && (
        <div className="admin-modal-overlay" onClick={() => !importing && setShowImportModal(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="admin-modal-header">
              <h2 className="admin-modal-title">Import OpenFlights Airports</h2>
              <button className="btn-icon" onClick={() => !importing && setShowImportModal(false)} disabled={importing}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleImportSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <p style={{ fontSize: 13, color: '#555', margin: 0 }}>
                  This will download and import real-world airports directly from the official OpenFlights repository dataset.
                </p>

                {/* Country Filter */}
                <div>
                  <label htmlFor="country-filter" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#5e5e5e', display: 'block', marginBottom: 6 }}>
                    Country Filter
                  </label>
                  <input
                    id="country-filter"
                    type="text"
                    value={countryFilter}
                    onChange={(e) => setCountryFilter(e.target.value)}
                    placeholder="e.g. India, United States (Leave empty for all)"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 6,
                      border: '1px solid rgba(0,0,0,0.15)',
                      fontSize: 13,
                      outline: 'none'
                    }}
                  />
                  <span style={{ fontSize: 11, color: '#777', marginTop: 4, display: 'block' }}>
                    Imports only airports located in these countries (comma-separated list).
                  </span>
                </div>

                {/* Configuration */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15 }}>
                  <div>
                    <label htmlFor="limit-input" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#5e5e5e', display: 'block', marginBottom: 6 }}>
                      Import Limit
                    </label>
                    <input
                      id="limit-input"
                      type="number"
                      value={limit}
                      onChange={(e) => setLimit(e.target.value)}
                      placeholder="e.g. 200 (Empty for all)"
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: 6,
                        border: '1px solid rgba(0,0,0,0.15)',
                        fontSize: 13,
                        outline: 'none'
                      }}
                    />
                    <span style={{ fontSize: 11, color: '#777', marginTop: 4, display: 'block' }}>
                      Keeps operation fast & safe
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 20 }}>
                    <input
                      type="checkbox"
                      id="overwrite-chk"
                      checked={overwrite}
                      onChange={(e) => setOverwrite(e.target.checked)}
                      style={{ width: 16, height: 16, cursor: 'pointer' }}
                    />
                    <label htmlFor="overwrite-chk" style={{ fontSize: 13, fontWeight: 600, color: '#1a1c1d', cursor: 'pointer' }}>
                      Overwrite existing
                    </label>
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12, color: '#475569' }}>
                  <strong>Note:</strong> Country codes matching the airport rows will be fetched or generated automatically using <code>pycountry</code> ISO definitions if not already in the database.
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 32 }}>
                <button type="button" className="btn-secondary" onClick={() => setShowImportModal(false)} disabled={importing}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={importing}>
                  {importing ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" style={{ marginRight: 6 }} /> Importing…
                    </>
                  ) : (
                    'Start Import'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
