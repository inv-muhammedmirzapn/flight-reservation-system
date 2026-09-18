import { useState, useRef, useCallback } from "react";
import { Upload, FileArchive, FileSpreadsheet, FileText } from "lucide-react";
import { fetchWithAuth, API_BASE_URL } from "@/services/apiClient";
import '@/admin/_core/styles/admin.css';
import { parseApiError } from '@/utils/errorUtils';

// ── Entity definitions ────────────────────────────────────────────────────────
// Operational / master data entities
const ENTITIES = [
  {
    id: "airlines",
    label: "Airlines",
    cols: ["iata_airline_code", "airline_name", "logo"],
    requiredCols: ["iata_airline_code", "airline_name"],
  },
  {
    id: "countries",
    label: "Countries",
    cols: ["iso_code", "name"],
    requiredCols: ["iso_code", "name"],
  },
  {
    id: "airports",
    label: "Airports",
    cols: ["iata_code", "airport_name", "city", "country_iso", "timezone", "latitude", "longitude"],
    requiredCols: ["iata_code", "airport_name", "city", "country_iso"],
  },
  {
    id: "aircraft_models",
    label: "Aircraft Models",
    cols: ["manufacturer", "model_name"],
    requiredCols: ["manufacturer", "model_name"],
  },
  {
    id: "aircraft",
    label: "Aircraft",
    cols: ["registration", "airline_code", "manufacturer", "model_name", "economy_capacity", "business_capacity", "first_class_capacity", "economy_layout", "business_layout", "first_class_layout"],
    requiredCols: ["registration", "airline_code", "manufacturer", "model_name"],
  },
  {
    id: "flight_routes",
    label: "Flight Routes",
    cols: ["flight_no", "airline_code", "operates_on_days", "valid_from", "valid_until", "scheduled_departure_time", "scheduled_arrival_time", "aircraft_registration", "baggage_weight_allowed_per_person", "handbag_weight_allowed_per_person", "extra_baggage_price_per_kg", "extra_baggage_currency"],
    requiredCols: ["flight_no", "airline_code"],
  },
  {
    id: "flight_legs",
    label: "Flight Legs",
    cols: ["flight_no", "leg_order", "departure_airport", "arrival_airport", "scheduled_departure_time", "scheduled_arrival_time", "flight_duration_minutes", "layover_duration_minutes", "departure_terminal", "arrival_terminal"],
    requiredCols: ["flight_no", "leg_order", "departure_airport", "arrival_airport"],
  },
  {
    id: "route_fare_classes",
    label: "Route Fare Classes",
    cols: ["flight_no", "cabin_class", "fare_code", "base_price", "currency", "refund_type", "change_fee", "meal_included", "baggage_weight_allowed_kg"],
    requiredCols: ["flight_no", "cabin_class", "fare_code", "base_price"],
  },
  {
    id: "flight_instances",
    label: "Flight Instances",
    cols: ["flight_no", "date", "aircraft_registration", "scheduled_departure", "scheduled_arrival", "status", "departure_terminal", "arrival_terminal", "boarding_gate", "delay_minutes"],
    requiredCols: ["flight_no", "date", "scheduled_departure", "scheduled_arrival"],
  },
  {
    id: "fares",
    label: "Fares",
    cols: ["flight_no", "date", "fare_code", "cabin_class", "price", "currency", "available_seats", "refund_type", "change_fee", "meal_included", "baggage_allowance", "handbag_allowance", "baggage_pieces_allowance"],
    requiredCols: ["flight_no", "date", "fare_code", "cabin_class", "price"],
  },
  {
    id: "seats",
    label: "Seats",
    cols: ["flight_no", "date", "seat_number", "seat_class", "position", "status", "exit_row", "extra_legroom", "seat_fee", "currency"],
    requiredCols: ["flight_no", "date", "seat_number", "seat_class"],
  },
  {
    id: "food_items",
    label: "Food Items",
    cols: ["airline_code", "name", "price", "currency", "is_veg", "is_halal", "is_vegan"],
    requiredCols: ["airline_code", "name"],
  },
  {
    id: "flight_meals",
    label: "Flight Meals",
    cols: ["airline_code", "cabin_class", "meal_name", "price"],
    requiredCols: ["airline_code", "cabin_class", "meal_name"],
  },
  {
    id: "flight_meal_items",
    label: "Flight Meal Items",
    cols: ["airline_code", "cabin_class", "meal_name", "food_item_name", "quantity"],
    requiredCols: ["airline_code", "cabin_class", "meal_name", "food_item_name"],
  },
  {
    id: "holiday_events",
    label: "Holiday Events (Dynamic Pricing)",
    cols: ["name", "start_date", "end_date", "surge_multiplier", "is_global", "applicable_countries", "is_active", "description"],
    requiredCols: ["name", "start_date", "end_date"],
  },
];

// User / account data entity (separate group)
const USER_ENTITIES = [
  {
    id: "users",
    label: "Users",
    cols: ["email", "username", "first_name", "last_name", "password", "role", "phone_number", "date_of_birth", "gender", "country", "state", "city"],
    requiredCols: ["email"],
  },
  {
    id: "bookings",
    label: "Bookings",
    cols: ["user_email", "flight_no", "date", "cabin_class", "seat_count", "total_price", "status", "passenger_name", "passenger_age", "passenger_gender", "seat_number"],
    requiredCols: ["user_email", "flight_no", "date"],
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
        <div className="flex flex-col items-center">
          {file.name.toLowerCase().endsWith(".zip") ? (
            <FileArchive className="w-10 h-10 text-status-green mb-2.5 stroke-[1.5]" />
          ) : file.name.toLowerCase().endsWith(".csv") || file.name.toLowerCase().endsWith(".xlsx") || file.name.toLowerCase().endsWith(".xls") ? (
            <FileSpreadsheet className="w-10 h-10 text-status-green mb-2.5 stroke-[1.5]" />
          ) : (
            <FileText className="w-10 h-10 text-status-green mb-2.5 stroke-[1.5]" />
          )}
          <p className="font-bold text-status-green text-sm mb-1">{file.name}</p>
          <p className="text-[11px] text-status-gray">{(file.size / 1024).toFixed(1)} KB — click to change</p>
        </div>
      ) : (
        <div className="flex flex-col items-center">
          <Upload className="w-9 h-9 text-[#9ca3af] mb-2.5 stroke-[1.5]" />
          <p className="font-bold text-[#374151] text-sm mb-1">Drop file here or click to browse</p>
          <p className="text-[11px] text-[#9ca3af]">{isZip ? ".zip archive" : ".csv  ·  .xls  ·  .xlsx"}</p>
        </div>
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
  const [progress, setProgress] = useState(null);

  const allEntityDefs = [...ENTITIES, ...USER_ENTITIES];
  const ent = allEntityDefs.find(e => e.id === entity);
  const isAll = entity === ALL_MODE;
  const canSubmit = entity && file && !loading;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError("");
    setProgress({
      percent: 5,
      message: "Uploading and preparing data...",
      step: 0,
      totalSteps: isAll ? 15 : 1,
      completedEntities: []
    });

    const formData = new FormData();
    formData.append("entity", entity);
    formData.append("file", file);

    try {
      const token = localStorage.getItem('access_token');
      const headers = {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      };
      const response = await fetch(`${API_BASE_URL}/bulk-upload/import/?stream=true`, {
        method: "POST",
        body: formData,
        headers,
        credentials: "include",
      });

      if (!response.ok) {
        let errDetail = "Upload failed.";
        try {
          const errData = await response.json();
          errDetail = parseApiError(errData, errDetail);
        } catch (_) {
          const errText = await response.text();
          if (errText) errDetail = errText;
        }
        throw new Error(errDetail);
      }

      // Check if response is streamable
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("text/event-stream") && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let completedList = [];

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop();

          for (const part of parts) {
            const trimmed = part.trim();
            if (!trimmed.startsWith("data:")) continue;
            const jsonStr = trimmed.replace(/^data:\s*/, "");
            try {
              const data = JSON.parse(jsonStr);

              if (data.type === "start") {
                setProgress(prev => ({
                  ...prev,
                  percent: data.percent || 5,
                  totalSteps: data.total_steps,
                  message: data.message || "Starting import...",
                }));
              } else if (data.type === "progress") {
                setProgress(prev => ({
                  ...prev,
                  percent: data.percent,
                  step: data.step,
                  totalSteps: data.total_steps,
                  activeEntity: data.entity,
                  activeLabel: data.label,
                  message: data.message,
                }));
              } else if (data.type === "entity_done") {
                completedList = [
                  ...completedList,
                  {
                    entity: data.entity,
                    label: data.label,
                    created: data.created,
                    failed: data.failed,
                  }
                ];
                setProgress(prev => ({
                  ...prev,
                  percent: data.percent,
                  step: data.step,
                  totalSteps: data.total_steps,
                  activeEntity: null,
                  activeLabel: null,
                  completedEntities: completedList,
                  totalCreated: data.total_created,
                  message: data.message,
                }));
              } else if (data.type === "done") {
                setProgress(prev => ({
                  ...prev,
                  percent: 100,
                  message: "Import complete!",
                }));
                setReports(data.reports ?? [data.report]);
                setFile(null);
              } else if (data.type === "error") {
                throw new Error(data.detail || "An error occurred during import.");
              }
            } catch (e) {
              if (e.message && !e.message.includes("JSON")) {
                throw e;
              }
            }
          }
        }
      } else {
        // Standard JSON response fallback
        const data = await response.json();
        setReports(data.reports ?? [data]);
        setFile(null);
      }
    } catch (err) {
      setError(parseApiError(err, "An unexpected error occurred."));
    } finally {
      setLoading(false);
      setProgress(null);
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

          {/* Columns & template hint */}
          {ent && (
            <div className="mb-5 bg-admin-accent-dark/[0.03] p-3.5 rounded-admin-sm border border-admin-accent-dark/[0.1] flex flex-col gap-2.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-[10px] font-bold text-[#666] uppercase tracking-[0.07em]">
                  Expected Columns
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5 items-center">
                {ent.cols.map(c => {
                  const isReq = ent.requiredCols?.includes(c);
                  return (
                    <code
                      key={c}
                      className={`text-[11px] py-[3px] px-2 rounded-full font-semibold transition-all ${
                        isReq
                          ? 'bg-admin-accent-dark/[0.12] text-admin-accent-dark border border-admin-accent-dark/20'
                          : 'bg-black/[0.04] text-[#6b7280] border border-black/[0.06]'
                      }`}
                      title={isReq ? "Required field" : "Optional field"}
                    >
                      {c}{isReq ? " *" : ""}
                    </code>
                  );
                })}
              </div>
              <div className="text-[10px] text-[#888]">
                <span className="font-semibold text-admin-accent-dark">* Required</span> · Others are optional / have defaults
              </div>
            </div>
          )}

          {isAll && (
            <div className="mb-5 bg-admin-accent-dark/[0.03] p-3.5 rounded-admin-sm border border-admin-accent-dark/[0.1] text-xs text-[#555]">
              <span className="font-bold text-admin-ink block mb-1">ZIP Archive Instructions</span>
              Include CSV or Excel files inside your .zip named after each entity, e.g. <code className="font-semibold text-admin-accent-dark">airlines.csv</code>, <code className="font-semibold text-admin-accent-dark">airports.csv</code>, <code className="font-semibold text-admin-accent-dark">flight_routes.csv</code>, <code className="font-semibold text-admin-accent-dark">route_fare_classes.csv</code>, <code className="font-semibold text-admin-accent-dark">flight_instances.csv</code>, etc. Files will be imported automatically in dependency order.
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

          {/* Progress Bar & Live Status */}
          {loading && progress && (
            <div className="mb-5 p-4 bg-admin-accent-dark/[0.04] border border-admin-accent-dark/20 rounded-admin-md transition-all duration-300">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-admin-accent-dark animate-pulse" />
                  <span className="text-xs font-bold text-admin-ink">
                    {progress.activeLabel ? `Importing ${progress.activeLabel}` : "Importing Data..."}
                  </span>
                </div>
                <span className="text-xs font-black text-admin-accent-dark tabular-nums">
                  {progress.percent}%
                </span>
              </div>

              {/* Animated Progress Bar Track */}
              <div className="w-full bg-black/[0.08] rounded-full h-3 overflow-hidden mb-2.5 p-[1px]">
                <div
                  className="bg-gradient-to-r from-[#ffd700] via-[#f59e0b] to-[#d97706] h-full rounded-full transition-all duration-300 ease-out shadow-sm relative overflow-hidden"
                  style={{ width: `${Math.max(4, Math.min(100, progress.percent))}%` }}
                >
                  <div className="absolute inset-0 bg-white/20 animate-pulse" />
                </div>
              </div>

              {/* Status Message and Counters */}
              <div className="flex items-center justify-between text-[11px] text-[#666]">
                <span className="truncate mr-2 font-medium">
                  {progress.message || (progress.step && progress.totalSteps ? `Table ${progress.step} of ${progress.totalSteps}` : "Processing...")}
                </span>
                {progress.totalCreated !== undefined && (
                  <span className="whitespace-nowrap font-semibold text-admin-ink tabular-nums">
                    ✓ {progress.totalCreated} created
                  </span>
                )}
              </div>
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
                <span>{progress?.percent ? `Importing… ${progress.percent}%` : "Importing…"}</span>
              </>
            ) : "Run Import"}
          </button>

        </div>
      </div>
    </div>
  );
}
