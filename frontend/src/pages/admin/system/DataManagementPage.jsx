import { useState, useRef, useCallback } from "react";
import { fetchWithAuth, extractErrorMessage } from "@/services/apiClient";
import '@/styles/admin-system.css';
import styles from './DataManagementPage.module.css';

// ── Entity definitions ────────────────────────────────────────────────────────
const ENTITIES = [
  { id: "countries", label: "Countries", cols: ["name", "iso_code"], example: ["India", "IN"] },
  { id: "airlines", label: "Airlines", cols: ["iata_airline_code", "airline_name"], example: ["AI", "Air India"] },
  { id: "airports", label: "Airports", cols: ["iata_code", "airport_name", "city", "country_iso", "timezone", "latitude", "longitude"], example: ["DEL", "Indira Gandhi Intl", "New Delhi", "IN", "Asia/Kolkata", "28.5665", "77.1031"] },
  { id: "aircraft_models", label: "Aircraft Models", cols: ["manufacturer", "model_name"], example: ["Boeing", "737-800"] },
  { id: "aircraft", label: "Aircraft", cols: ["registration", "airline_code", "manufacturer", "model_name", "economy_capacity", "business_capacity", "first_class_capacity"], example: ["VT-ANL", "AI", "Boeing", "737-800", "160", "20", "8"] },
  { id: "flight_routes", label: "Flight Routes", cols: ["flight_no", "airline_code", "baggage_weight_allowed_per_person", "handbag_weight_allowed_per_person"], example: ["AI202", "AI", "25", "7"] },
  { id: "flight_instances", label: "Flight Instances", cols: ["flight_no", "date", "aircraft_registration", "status", "scheduled_departure", "scheduled_arrival"], example: ["AI202", "2025-08-01", "VT-ANL", "SCHEDULED", "2025-08-01 06:00", "2025-08-01 09:00"] },
  { id: "flight_legs", label: "Flight Legs", cols: ["flight_no", "leg_order", "departure_airport", "arrival_airport", "scheduled_departure", "scheduled_arrival"], example: ["AI202", "1", "DEL", "BOM", "2025-08-01 06:00", "2025-08-01 09:00"] },
  { id: "food_items", label: "Food Items", cols: ["airline_code", "name", "price", "currency", "is_veg", "is_halal", "is_vegan"], example: ["AI", "Veg Biryani", "250", "INR", "true", "false", "false"] },
  { id: "flight_meals", label: "Flight Meals", cols: ["flight_no", "date", "meal_name"], example: ["AI202", "2025-08-01", "Breakfast"] },
  { id: "fares", label: "Fares", cols: ["flight_no", "date", "fare_code", "cabin_class", "price", "currency", "available_seats", "refund_type", "change_fee", "meal_included"], example: ["AI202", "2025-08-01", "ECO-SAVE", "ECONOMY", "4500", "INR", "80", "NON_REFUNDABLE", "500", "false"] },
];

const ALL_MODE = "all";

// ── Custom Dropdown ───────────────────────────────────────────────────────────
function EntityDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();

  const handleBlur = useCallback((e) => {
    if (ref.current && !ref.current.contains(e.relatedTarget)) setOpen(false);
  }, []);

  const selected = value === ALL_MODE
    ? { label: "Import All" }
    : ENTITIES.find(e => e.id === value);

  const select = (id) => { onChange(id); setOpen(false); };

  const triggerClass = [
    styles.dropdownTrigger,
    open ? styles.dropdownTriggerOpen : "",
    selected ? styles.dropdownTriggerSelected : "",
  ].join(" ");

  return (
    <div ref={ref} className={styles.dropdown} onBlur={handleBlur} tabIndex={-1}>
      <button type="button" onClick={() => setOpen(o => !o)} className={triggerClass}>
        <span className={styles.dropdownTriggerLabel}>
          {selected ? selected.label : "Select a table…"}
        </span>
        <svg
          width="14" height="14" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2.5"
          className={`${styles.dropdownChevron} ${open ? styles.dropdownChevronOpen : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className={styles.dropdownPanel}>
          {/* Import All */}
          <button
            type="button"
            tabIndex={0}
            onClick={() => select(ALL_MODE)}
            className={`${styles.dropdownOption} ${styles.dropdownOptionAll} ${value === ALL_MODE ? styles.dropdownOptionActive : ""}`}
          >
            <span>
              Import All
              <span className={styles.dropdownOptionFormats}>.zip · .csv · .xls · .xlsx</span>
            </span>
            {value === ALL_MODE && <span className={styles.dropdownCheck}>✓</span>}
          </button>

          <div className={styles.dropdownDivider}>Individual Tables</div>

          {ENTITIES.map((e) => (
            <button
              key={e.id}
              type="button"
              tabIndex={0}
              onClick={() => select(e.id)}
              className={`${styles.dropdownOption} ${value === e.id ? styles.dropdownOptionActive : ""}`}
            >
              <span>{e.label}</span>
              {value === e.id && <span className={styles.dropdownCheck}>✓</span>}
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

  const zoneClass = [
    styles.dropzone,
    dragging ? styles.dropzoneDragging : "",
    file ? styles.dropzoneHasFile : "",
    disabled ? styles.dropzoneDisabled : "",
  ].filter(Boolean).join(" ");

  return (
    <div
      className={zoneClass}
      onDrop={handleDrop}
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onClick={() => !disabled && inputRef.current.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept={isZip ? ".zip" : ".csv,.xls,.xlsx"}
        style={{ display: "none" }}
        onChange={(e) => { const f = e.target.files[0]; if (f) onFile(f); }}
        disabled={disabled}
      />
      {file ? (
        <>
          <span className={styles.dropzoneFileIcon}>📄</span>
          <p className={styles.dropzoneFilename}>{file.name}</p>
          <p className={styles.dropzoneFilesize}>{(file.size / 1024).toFixed(1)} KB — click to change</p>
        </>
      ) : (
        <>
          <span className={styles.dropzoneIcon}>☁️</span>
          <p className={styles.dropzoneTitle}>Drop file here or click to browse</p>
          <p className={styles.dropzoneHint}>{isZip ? ".zip archive" : ".csv  ·  .xls  ·  .xlsx"}</p>
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
      <div className={`admin-modal ${styles.reportModal}`} onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal-header">
          <h2 className="admin-modal-title">Import Report</h2>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>

        {/* Stats */}
        <div className={styles.reportStats}>
          {statCards.map(({ label, value, cardMod, valMod }) => (
            <div key={label} className={`${styles.statCard} ${styles[`statCard${cardMod}`]}`}>
              <div className={`${styles.statValue} ${styles[`statValue${valMod}`]}`}>{value}</div>
              <div className={styles.statLabel}>{label}</div>
            </div>
          ))}
        </div>

        {/* Per-entity breakdown */}
        {multiMode && (
          <div className={styles.entityBreakdown}>
            {reports.map((r) => {
              const ent = ENTITIES.find(e => e.id === r.entity);
              return (
                <div key={r.entity} className={`${styles.entityRow} ${r.failed > 0 ? styles.entityRowErr : styles.entityRowOk}`}>
                  <span className={styles.entityName}>{ent?.label || r.entity}</span>
                  <span className={styles.entityOk}>
                    ✓ {r.success} <span className={styles.entitySub}>(C:{r.created || 0} M:{r.updated || 0})</span>
                  </span>
                  {r.failed > 0 && <span className={styles.entityFail}>✕ {r.failed}</span>}
                </div>
              );
            })}
          </div>
        )}

        {/* Success / error detail */}
        {totals.failed === 0 ? (
          <div className={styles.successBanner}>
            <p className={styles.successText}>All rows imported successfully!</p>
          </div>
        ) : (
          reports.filter(r => r.errors?.length).map(r => {
            const ent = ENTITIES.find(e => e.id === r.entity);
            return (
              <div key={r.entity} className={styles.errorSection}>
                <p className={styles.errorHeading}>
                  {ent?.label || r.entity} — {r.errors.length} failed row{r.errors.length !== 1 ? "s" : ""}
                </p>
                <div className={styles.errorTableWrap}>
                  <table className={styles.errorTable}>
                    <thead>
                      <tr>
                        {["Row", "Field", "Error"].map(h => <th key={h}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {r.errors.map((err, idx) => {
                        const entries = Object.entries(err.errors || {});
                        return entries.map(([field, msg], j) => (
                          <tr key={`${idx}-${j}`}>
                            {j === 0 && (
                              <td rowSpan={entries.length} className={styles.errorRowNum}>#{err.row}</td>
                            )}
                            <td className={styles.errorField}>{field}</td>
                            <td className={styles.errorMsg}>{Array.isArray(msg) ? msg.join("; ") : String(msg)}</td>
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

        <div className={styles.reportFooter}>
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

  const ent = ENTITIES.find(e => e.id === entity);
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
      setError(err?.data ? extractErrorMessage(err.data) : err.message || "An unexpected error occurred.");
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

        <div className={`admin-card ${styles.card}`}>

          {/* Target table */}
          <div className={styles.field}>
            <label className={styles.label}>Target Table</label>
            <EntityDropdown
              value={entity}
              onChange={(v) => { setEntity(v); setFile(null); setError(""); }}
            />
          </div>

          {/* Required columns hint */}
          {ent && (
            <div className={styles.colsHint}>
              <span className={styles.colsLabel}>Required Columns:</span>
              <div className={styles.colsList}>
                {ent.cols.map(c => <code key={c} className={styles.colPill}>{c}</code>)}
              </div>
            </div>
          )}

          {/* Drop zone */}
          <div className={styles.field}>
            <label className={styles.label}>Upload File</label>
            <DropZone
              file={file}
              onFile={(f) => { setFile(f); setError(""); }}
              disabled={!entity || loading}
              isZip={isAll}
            />
          </div>

          {/* Error */}
          {error && (
            <div className={`admin-error ${styles.error}`}>
              <span>{error}</span>
            </div>
          )}

          {/* Submit */}
          <button
            id="bulk-import-submit"
            className={`btn-primary ${styles.submit}`}
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {loading ? (
              <>
                <span className={styles.spinner} />
                Importing…
              </>
            ) : "Run Import"}
          </button>

        </div>
      </div>
    </div>
  );
}
