import { useState, useRef, useCallback } from "react";
import { fetchWithAuth } from "@/services/apiClient";
import '@/admin/_core/styles/admin.css';
import { parseApiError } from '@/utils/errorUtils';

// ── Entity definitions ────────────────────────────────────────────────────────
// Operational / master data entities
const ENTITIES = [
  { id: "airlines", label: "Airlines", cols: ["iata_airline_code", "airline_name"], example: ["AI", "Air India"] },
  { id: "airports", label: "Airports", cols: ["iata_code", "airport_name", "city", "country_iso", "timezone", "latitude", "longitude"], example: ["DEL", "Indira Gandhi Intl", "New Delhi", "IN", "Asia/Kolkata", "28.5665", "77.1031"] },
  { id: "aircraft_models", label: "Aircraft Models", cols: ["manufacturer", "model_name"], example: ["Boeing", "737-800"] },
  { id: "aircraft", label: "Aircraft", cols: ["registration", "airline_code", "manufacturer", "model_name", "economy_capacity", "business_capacity", "first_class_capacity", "economy_layout", "business_layout", "first_class_layout"], example: ["VT-ANL", "AI", "Boeing", "737-800", "160", "20", "8", "3-3", "2-2", "2-2"] },
  { id: "flight_routes", label: "Flight Routes", cols: ["flight_no", "airline_code", "baggage_weight_allowed_per_person", "handbag_weight_allowed_per_person", "max_extra_baggage_kg_per_person", "extra_baggage_price_per_kg", "extra_baggage_currency"], example: ["AI202", "AI", "25", "7", "20", "500", "INR"] },
  { id: "flight_instances", label: "Flight Instances", cols: ["flight_no", "date", "aircraft_registration", "status", "scheduled_departure", "scheduled_arrival"], example: ["AI202", "2025-08-01", "VT-ANL", "SCHEDULED", "2025-08-01 06:00", "2025-08-01 09:00"] },
  { id: "flight_legs", label: "Flight Legs", cols: ["flight_no", "leg_order", "departure_airport", "arrival_airport", "scheduled_departure", "scheduled_arrival"], example: ["AI202", "1", "DEL", "BOM", "2025-08-01 06:00", "2025-08-01 09:00"] },
  { id: "food_items", label: "Food Items", cols: ["airline_code", "name", "price", "currency", "is_veg", "is_halal", "is_vegan"], example: ["AI", "Veg Biryani", "250", "INR", "true", "false", "false"] },
  { id: "flight_meals", label: "Flight Meals", cols: ["flight_no", "date", "meal_name", "price"], example: ["AI202", "2025-08-01", "Breakfast", "0"] },
  { id: "fares", label: "Fares", cols: ["flight_no", "date", "fare_code", "cabin_class", "price", "currency", "available_seats", "refund_type", "change_fee", "meal_included"], example: ["AI202", "2025-08-01", "ECO-SAVE", "ECONOMY", "4500", "INR", "80", "NON_REFUNDABLE", "500", "false"] },
];

// User / account data entity (separate group)
const USER_ENTITIES = [
  {
    id: "users",
    label: "Users",
    cols: ["email", "username", "first_name", "last_name", "password", "role", "phone_number", "date_of_birth", "gender", "country", "state", "city"],
    example: ["john@example.com", "johndoe", "John", "Doe", "Secret123", "CUSTOMER", "+919876543210", "1990-01-15", "MALE", "India", "Kerala", "Kochi"],
  },
];

const ALL_MODE = "all";

// ── Custom Dropdown ───────────────────────────────────────────────────────────
function EntityDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();

  const handleBlur = useCallback((e) => {
    if (ref.current && !ref.current.contains(e.relatedTarget)) setOpen(false);
  }, []);

  const allEntities = [...ENTITIES, ...USER_ENTITIES];
  const selected = value === ALL_MODE
    ? { label: "Import All" }
    : allEntities.find(e => e.id === value);

  const select = (id) => { onChange(id); setOpen(false); };

  return (
    <div ref={ref} className="relative" onBlur={handleBlur} tabIndex={-1}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between py-[11px] px-4 rounded-admin-sm border cursor-pointer font-ui text-[13px] transition-all duration-150 ${
          open 
            ? 'border-admin-accent-dark bg-admin-accent-dark/[0.03] shadow-[0_0_0_3px_rgba(112,93,0,0.08)]' 
            : 'border-black/10 bg-white'
        } ${selected ? 'font-semibold text-admin-ink' : 'font-normal text-[#9ca3af]'}`}
      >
        <span className="flex items-center gap-2">
          {selected ? selected.label : "Select a table…"}
        </span>
        <svg
          width="14" height="14" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2.5"
          className={`text-[#9ca3af] shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-[calc(100%+6px)] left-0 right-0 z-50 bg-white rounded-admin-md border border-black/[0.08] shadow-2xl max-h-[300px] overflow-y-auto">
          {/* Import All */}
          <button
            type="button"
            tabIndex={0}
            onClick={() => select(ALL_MODE)}
            className={`w-full flex items-center justify-between py-2 px-4 border-b border-black/[0.06] bg-transparent cursor-pointer font-ui text-[13px] text-left transition-colors duration-100 hover:bg-black/[0.03] ${
              value === ALL_MODE ? 'bg-admin-accent-dark/[0.06] font-bold text-admin-accent-dark' : 'font-bold text-admin-ink'
            }`}
          >
            <span>
              Import All
              <span className="font-normal text-[#9ca3af] text-[11px] ml-1.5">.zip · .csv · .xls · .xlsx</span>
            </span>
            {value === ALL_MODE && <span className="text-xs text-admin-accent-dark">✓</span>}
          </button>

          {/* Operational / Master Data */}
          <div className="py-1.5 px-4 pt-2.5 text-[10px] font-bold text-[#bbb] uppercase tracking-[0.07em]">Operational & Master Data</div>

          {ENTITIES.map((e) => (
            <button
              key={e.id}
              type="button"
              tabIndex={0}
              onClick={() => select(e.id)}
              className={`w-full flex items-center justify-between py-2 px-4 border-none bg-transparent cursor-pointer font-ui text-[13px] text-left transition-colors duration-100 hover:bg-black/[0.03] ${
                value === e.id ? 'bg-admin-accent-dark/[0.06] font-bold text-admin-accent-dark' : 'font-normal text-[#374151]'
              }`}
            >
              <span>{e.label}</span>
              {value === e.id && <span className="text-xs text-admin-accent-dark">✓</span>}
            </button>
          ))}

          {/* User Data */}
          <div className="py-1.5 px-4 pt-2.5 text-[10px] font-bold text-[#bbb] uppercase tracking-[0.07em] border-t border-black/[0.05] mt-1">User Accounts</div>

          {USER_ENTITIES.map((e) => (
            <button
              key={e.id}
              type="button"
              tabIndex={0}
              onClick={() => select(e.id)}
              className={`w-full flex items-center justify-between py-2 px-4 border-none bg-transparent cursor-pointer font-ui text-[13px] text-left transition-colors duration-100 hover:bg-black/[0.03] ${
                value === e.id ? 'bg-admin-accent-dark/[0.06] font-bold text-admin-accent-dark' : 'font-normal text-[#374151]'
              }`}
            >
              <span>{e.label}</span>
              {value === e.id && <span className="text-xs text-admin-accent-dark">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Drop Zone ─────────────────────────────────────────────────────────────────
function DropZone({ file, onFile, disabled, isZip }) {
  const inputRef = useRef();
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    if (!disabled) { const f = e.dataTransfer.files[0]; if (f) onFile(f); }
  }, [onFile, disabled]);

  return (
    <div
      className={`border-2 border-dashed rounded-admin-md py-11 px-6 text-center cursor-pointer transition-all duration-150 ${
        dragging ? 'border-admin-accent-dark bg-admin-accent-dark/[0.04]' : ''
      } ${file ? 'border-status-green bg-[#f0fdf4]' : 'border-black/10 bg-white/40'} ${
        disabled ? 'opacity-45 cursor-not-allowed' : ''
      }`}
      onDrop={handleDrop}
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onClick={() => !disabled && inputRef.current.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept={isZip ? ".zip" : ".csv,.xls,.xlsx"}
        className="hidden"
        onChange={(e) => { const f = e.target.files[0]; if (f) onFile(f); }}
        disabled={disabled}
      />
      {file ? (
        <>
          <span className="text-4xl mb-2.5 block">📄</span>
          <p className="font-bold text-status-green text-sm mb-1">{file.name}</p>
          <p className="text-[11px] text-status-gray">{(file.size / 1024).toFixed(1)} KB — click to change</p>
        </>
      ) : (
        <>
          <span className="text-3xl mb-2.5 opacity-35 block">☁️</span>
          <p className="font-bold text-[#374151] text-sm mb-1">Drop file here or click to browse</p>
          <p className="text-[11px] text-[#9ca3af]">{isZip ? ".zip archive" : ".csv  ·  .xls  ·  .xlsx"}</p>
        </>
      )}
    </div>
  );
}

// ── Report Modal ──────────────────────────────────────────────────────────────
function ReportModal({ reports, onClose }) {
  if (!reports || reports.length === 0) return null;

  const totals = reports.reduce((acc, r) => ({
    total: acc.total + (r.total || 0),
    success: acc.success + (r.success || 0),
    failed: acc.failed + (r.failed || 0),
    created: acc.created + (r.created || 0),
    updated: acc.updated + (r.updated || 0),
  }), { total: 0, success: 0, failed: 0, created: 0, updated: 0 });

  const multiMode = reports.length > 1;

  const statCards = [
    { label: "Total Rows", value: totals.total, cardMod: "Neutral", valMod: "Neutral" },
    { label: "Created", value: totals.created, cardMod: "Success", valMod: "Success" },
    { label: "Modified", value: totals.updated, cardMod: "Success", valMod: "Success" },
    { label: "Failed", value: totals.failed, cardMod: totals.failed > 0 ? "Failure" : "Neutral", valMod: totals.failed > 0 ? "Failure" : "Zero" },
  ];

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal max-w-[640px] w-full" onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal-header">
          <h2 className="admin-modal-title">Import Report</h2>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 mb-5">
          {statCards.map(({ label, value, cardMod, valMod }) => (
            <div 
              key={label} 
              className={`text-center py-3.5 px-2.5 rounded-xl ${
                cardMod === "Success" ? "bg-[#f0fdf4]" : cardMod === "Failure" ? "bg-[#fef2f2]" : "bg-[#f3f4f6]"
              }`}
            >
              <div 
                className={`text-2xl font-extrabold ${
                  valMod === "Success" ? "text-[#16a34a]" : valMod === "Failure" ? "text-[#dc2626]" : valMod === "Zero" ? "text-[#9ca3af]" : "text-[#374151]"
                }`}
              >
                {value}
              </div>
              <div className="text-[10px] font-bold text-[#6b7280] mt-0.5 uppercase tracking-[0.06em]">{label}</div>
            </div>
          ))}
        </div>

        {/* Per-entity breakdown */}
        {multiMode && (
          <div className="flex flex-col gap-2 mb-4">
            {reports.map((r) => {
              const allEntities = [...ENTITIES, ...USER_ENTITIES];
              const ent = allEntities.find(e => e.id === r.entity);
              return (
                <div 
                  key={r.entity} 
                  className={`flex items-center py-2 px-3 rounded-lg ${
                    r.failed > 0 ? "bg-[#fef2f2] border border-[#fecaca]" : "bg-[#f0fdf4] border border-[#bbf7d0]"
                  }`}
                >
                  <span className="font-bold text-[12px] flex-1">{ent?.label || r.entity}</span>
                  <span className="text-[12px] text-[#16a34a] font-bold mr-2.5">
                    ✓ {r.success} <span className="text-[10px] opacity-80 ml-1 font-medium">(C:{r.created || 0} M:{r.updated || 0})</span>
                  </span>
                  {r.failed > 0 && <span className="text-[12px] text-[#dc2626] font-bold">✕ {r.failed}</span>}
                </div>
              );
            })}
          </div>
        )}

        {/* Success / error detail */}
        {totals.failed === 0 ? (
          <div className="text-center py-6 bg-gradient-to-br from-[#f0fdf4] to-[#dcfce7] rounded-xl border border-[#bbf7d0]">
            <p className="m-0 font-bold text-[#15803d] text-sm">All rows imported successfully!</p>
          </div>
        ) : (
          reports.filter(r => r.errors?.length).map(r => {
            const allEntities = [...ENTITIES, ...USER_ENTITIES];
            const ent = allEntities.find(e => e.id === r.entity);
            return (
              <div key={r.entity} className="mb-4">
                <p className="m-0 mb-1.5 text-xs font-bold text-[#dc2626]">
                  {ent?.label || r.entity} — {r.errors.length} failed row{r.errors.length !== 1 ? "s" : ""}
                </p>
                <div className="max-h-[200px] overflow-y-auto rounded-lg border border-[#fecaca]">
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#fef2f2] sticky top-0">
                        {["Row", "Field", "Error"].map(h => (
                          <th key={h} className="py-1.5 px-3 text-left font-bold text-[10px] text-[#dc2626] uppercase tracking-[0.06em]">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {r.errors.map((err, idx) => {
                        const entries = Object.entries(err.errors || {});
                        return entries.map(([field, msg], j) => (
                          <tr key={`${idx}-${j}`} className={idx % 2 === 0 ? "bg-[#fafafa]" : "bg-white"}>
                            {j === 0 && (
                              <td rowSpan={entries.length} className="py-1.5 px-3 border-t border-[#fee2e2] font-bold text-[#dc2626] vertical-align-top">
                                #{err.row}
                              </td>
                            )}
                            <td className="py-1.5 px-3 border-t border-[#fee2e2] font-mono text-[#7c3aed]">{field}</td>
                            <td className="py-1.5 px-3 border-t border-[#fee2e2] text-[#374151]">
                              {Array.isArray(msg) ? msg.join("; ") : String(msg)}
                            </td>
                          </tr>
                        ));
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })
        )}

        <div className="flex justify-end mt-6">
          <button className="btn-primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function BulkImportPage() {
  const [entity, setEntity] = useState("");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState(null);
  const [error, setError] = useState("");

  const allEntityDefs = [...ENTITIES, ...USER_ENTITIES];
  const ent = allEntityDefs.find(e => e.id === entity);
  const isAll = entity === ALL_MODE;
  const canSubmit = entity && file && !loading;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError("");
    const formData = new FormData();
    formData.append("entity", entity);
    formData.append("file", file);
    try {
      const data = await fetchWithAuth("/bulk-upload/import/", { method: "POST", body: formData });
      setReports(data.reports ?? [data]);
      setFile(null);
    } catch (err) {
      setError(parseApiError(err, "An unexpected error occurred."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-page">
      <div className="admin-container">
        <ReportModal reports={reports} onClose={() => setReports(null)} />

        <div className="admin-page-header">
          <div>
            <h1 className="admin-page-title">Bulk Import</h1>
            <p className="admin-page-subtitle">Upload CSV, Excel, or ZIP files to import master data.</p>
          </div>
        </div>

        <div className="admin-card p-7 max-w-[600px] mx-auto overflow-visible">

          {/* Target table */}
          <div className="mb-5">
            <label className="block text-[11px] font-bold text-[#5e5e5e] mb-2 uppercase tracking-[0.07em]">Target Table</label>
            <EntityDropdown
              value={entity}
              onChange={(v) => { setEntity(v); setFile(null); setError(""); }}
            />
          </div>

          {/* Required columns hint */}
          {ent && (
            <div className="mb-5 bg-admin-accent-dark/[0.03] py-2.5 px-3.5 rounded-admin-sm border border-admin-accent-dark/[0.1] flex items-center gap-3 flex-wrap">
              <span className="text-[10px] font-bold text-[#888] uppercase tracking-[0.07em] whitespace-nowrap">Required Columns:</span>
              <div className="flex flex-wrap gap-1.5">
                {ent.cols.map(c => (
                  <code key={c} className="text-[11px] bg-admin-accent-dark/[0.08] py-[3px] px-2 rounded-full text-admin-accent-dark font-semibold">
                    {c}
                  </code>
                ))}
              </div>
            </div>
          )}

          {/* Drop zone */}
          <div className="mb-5">
            <label className="block text-[11px] font-bold text-[#5e5e5e] mb-2 uppercase tracking-[0.07em]">Upload File</label>
            <DropZone
              file={file}
              onFile={(f) => { setFile(f); setError(""); }}
              disabled={!entity || loading}
              isZip={isAll}
            />
          </div>

          {/* Error */}
          {error && (
            <div className="admin-error mb-4">
              <span>{error}</span>
            </div>
          )}

          {/* Submit */}
          <button
            id="bulk-import-submit"
            className="btn-primary w-full justify-center h-11 text-sm"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {loading ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-black/20 border-t-black rounded-full inline-block animate-spin mr-2" />
                Importing…
              </>
            ) : "Run Import"}
          </button>

        </div>
      </div>
    </div>
  );
}
