import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import AdminCrudPage from '@/admin/_core/AdminCrudPage';
import { fetchCountries } from '@/admin/_core/store/adminSlices';
import {
  fetchAirports, fetchAirportDetail, addAirport, updateAirport, removeAirport,
  importOpenFlights,
} from '@/admin/_core/store/adminSlices';
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

  useEffect(() => { dispatch(fetchCountries({ page_size: 1000 })); }, [dispatch]);

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
        <div
          className="admin-modal-overlay"
          onClick={() => !importing && setShowImportModal(false)}
        >
          <div
            className="admin-modal max-w-[480px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="admin-modal-header">
              <h2 className="admin-modal-title">Import OpenFlights Airports</h2>
              <button
                className="btn-icon"
                onClick={() => !importing && setShowImportModal(false)}
                disabled={importing}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleImportSubmit}>
              <div className="flex flex-col gap-5">
                <p className="text-admin-sm text-[#555] m-0">
                  This will download and import real-world airports directly from the official OpenFlights repository dataset.
                </p>

                {/* Country Filter */}
                <div>
                  <label
                    htmlFor="country-filter"
                    className="block mb-1.5 text-admin-xs font-bold uppercase tracking-[.06em] text-[#5e5e5e]"
                  >
                    Country Filter
                  </label>
                  <input
                    id="country-filter"
                    type="text"
                    value={countryFilter}
                    onChange={(e) => setCountryFilter(e.target.value)}
                    placeholder="e.g. India, United States (Leave empty for all)"
                    className="w-full rounded-md border border-black/[0.15] px-3 py-2 text-admin-sm bg-white outline-none font-ui text-[#1a1c1d] transition-[border-color,box-shadow] duration-150 focus:border-admin-accent-dark focus:shadow-[0_0_0_3px_rgba(112,93,0,0.1)]"
                  />
                  <span className="mt-1 block text-admin-xs text-[#777]">
                    Imports only airports located in these countries (comma-separated list).
                  </span>
                </div>

                {/* Configuration */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="limit-input"
                      className="block mb-1.5 text-admin-xs font-bold uppercase tracking-[.06em] text-[#5e5e5e]"
                    >
                      Import Limit
                    </label>
                    <input
                      id="limit-input"
                      type="number"
                      value={limit}
                      onChange={(e) => setLimit(e.target.value)}
                      placeholder="e.g. 200 (Empty for all)"
                      className="w-full rounded-md border border-black/[0.15] px-3 py-2 text-admin-sm bg-white outline-none font-ui text-[#1a1c1d] transition-[border-color,box-shadow] duration-150 focus:border-admin-accent-dark focus:shadow-[0_0_0_3px_rgba(112,93,0,0.1)]"
                    />
                    <span className="mt-1 block text-admin-xs text-[#777]">
                      Keeps operation fast &amp; safe
                    </span>
                  </div>

                  <div className="flex items-center gap-2 pt-5">
                    <input
                      type="checkbox"
                      id="overwrite-chk"
                      checked={overwrite}
                      onChange={(e) => setOverwrite(e.target.checked)}
                      className="h-4 w-4 cursor-pointer accent-admin-accent"
                    />
                    <label
                      htmlFor="overwrite-chk"
                      className="cursor-pointer text-admin-sm font-semibold text-[#1a1c1d]"
                    >
                      Overwrite existing
                    </label>
                  </div>
                </div>

                <div className="rounded-admin-md border border-[#e2e8f0] bg-[#f8fafc] p-3 text-admin-xs text-[#475569]">
                  <strong>Note:</strong> Country codes matching the airport rows will be fetched or generated automatically using <code>pycountry</code> ISO definitions if not already in the database.
                </div>
              </div>

              <div className="mt-8 flex justify-end gap-2.5">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowImportModal(false)}
                  disabled={importing}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={importing}>
                  {importing ? (
                    <>
                      <RefreshCw size={14} className="mr-1.5 animate-spin" /> Importing…
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