/**
 * DynamicPricingPage — Admin panel for Dynamic Pricing Architecture.
 * Includes:
 * 1. Global Engine Configuration & Manual Re-evaluation Trigger
 * 2. Interactive Dynamic Pricing Simulator
 * 3. Holiday Events Management (CRUD)
 * 4. Dynamic Price Audit Logs
 */
import { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchDynamicPricingConfigs,
  updateDynamicPricingConfig,
  evaluateAllDynamicPricing,
  simulateDynamicPricing,
  fetchHolidayEvents,
  addHolidayEvent,
  removeHolidayEvent,
  fetchDynamicPriceLogs,
  fetchRouteFareClasses,
  fetchCountries,
  ADMIN_PAGE_SIZE,
} from '@/admin/_core/store/adminSlices';
import { Pagination } from '@/components/ui/Pagination';
import { SpinnerLoader } from '@/components/ui/Loaders';
import '@/admin/_core/styles/admin.css';
import {
  TrendingUp,
  Settings,
  Zap,
  Calendar,
  History,
  AlertCircle,
  Plus,
  Trash2,
  Play,
  CheckCircle2,
  Clock,
  Sparkles,
  Plane,
  Tag,
  ShieldAlert,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function DynamicPricingPage() {
  const dispatch = useDispatch();

  // Redux States
  const { items: configs, loading: configLoading } = useSelector((s) => s.dynamicPricingConfig || {});
  const { items: holidays, loading: holidaysLoading } = useSelector((s) => s.holidayEvent || {});
  const { items: logs, loading: logsLoading, count: logsCount } = useSelector((s) => s.dynamicPriceLog || {});
  const { items: routeFares } = useSelector((s) => s.routeFareClass || {});
  const { items: countries } = useSelector((s) => s.country || {});

  const currentConfig = configs && configs.length > 0 ? configs[0] : null;

  // Local Form States for Config
  const [configForm, setConfigForm] = useState({
    is_enabled: true,
    weekend_multiplier: '1.15',
    holiday_multiplier: '1.25',
    demand_surge_per_booking: '0.05',
    max_surge_cap: '1.80',
    demand_window_days: 7,
  });
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);

  // Simulator States
  const [simForm, setSimForm] = useState({
    route_fare_id: '',
    flight_date: new Date().toISOString().split('T')[0],
    mock_booking_count: 5,
  });
  const [simResult, setSimResult] = useState(null);
  const [isSimulating, setIsSimulating] = useState(false);

  // Holiday Modal State
  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [holidayForm, setHolidayForm] = useState({
    name: '',
    country: '',
    start_date: '',
    end_date: '',
    multiplier: '1.20',
  });
  const [isAddingHoliday, setIsAddingHoliday] = useState(false);

  // Log Pagination State
  const [logPage, setLogPage] = useState(1);

  // Initial Data Load
  useEffect(() => {
    dispatch(fetchDynamicPricingConfigs());
    dispatch(fetchHolidayEvents());
    dispatch(fetchRouteFareClasses({ limit: 100 }));
    dispatch(fetchCountries({ limit: 200 }));
  }, [dispatch]);

  useEffect(() => {
    if (currentConfig) {
      setConfigForm({
        is_enabled: currentConfig.is_enabled ?? true,
        weekend_multiplier: currentConfig.weekend_multiplier || '1.15',
        holiday_multiplier: currentConfig.holiday_multiplier || '1.25',
        demand_surge_per_booking: currentConfig.demand_surge_per_booking || '0.05',
        max_surge_cap: currentConfig.max_surge_cap || '1.80',
        demand_window_days: currentConfig.demand_window_days || 7,
      });
    }
  }, [currentConfig]);

  const loadLogs = useCallback(
    (page) => {
      dispatch(fetchDynamicPriceLogs({ page }));
    },
    [dispatch]
  );

  useEffect(() => {
    loadLogs(logPage);
  }, [loadLogs, logPage]);

  // Handle Save Configuration
  const handleSaveConfig = async (e) => {
    e.preventDefault();
    if (!currentConfig?.id) {
      toast.error('No configuration record found to update.');
      return;
    }
    setIsSavingConfig(true);
    try {
      await dispatch(
        updateDynamicPricingConfig({
          id: currentConfig.id,
          data: configForm,
        })
      ).unwrap();
      toast.success('Dynamic pricing engine configuration saved.');
    } catch (err) {
      toast.error(typeof err === 'string' ? err : 'Failed to save configuration.');
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Handle Manual Global Re-evaluation
  const handleEvaluateAll = async () => {
    if (!window.confirm('Trigger manual re-evaluation of dynamic prices for all upcoming flight fares?')) {
      return;
    }
    setIsEvaluating(true);
    try {
      const res = await dispatch(evaluateAllDynamicPricing()).unwrap();
      toast.success(res.message || 'Dynamic price re-evaluation completed!');
      dispatch(fetchDynamicPriceLogs({ page: 1 }));
      setLogPage(1);
    } catch (err) {
      toast.error(typeof err === 'string' ? err : 'Re-evaluation failed.');
    } finally {
      setIsEvaluating(false);
    }
  };

  // Handle Pricing Simulation
  const handleRunSimulation = async (e) => {
    e.preventDefault();
    if (!simForm.route_fare_id) {
      toast.error('Please select a route fare class for simulation.');
      return;
    }
    setIsSimulating(true);
    try {
      const res = await dispatch(
        simulateDynamicPricing({
          route_fare_id: simForm.route_fare_id,
          flight_date: simForm.flight_date,
          mock_booking_count: Number(simForm.mock_booking_count),
        })
      ).unwrap();
      setSimResult(res);
      toast.success('Simulation executed successfully!');
    } catch (err) {
      toast.error(typeof err === 'string' ? err : 'Simulation failed.');
    } finally {
      setIsSimulating(false);
    }
  };

  // Handle Add Holiday Event
  const handleAddHoliday = async (e) => {
    e.preventDefault();
    if (!holidayForm.name || !holidayForm.start_date || !holidayForm.end_date) {
      toast.error('Please complete all required fields.');
      return;
    }
    setIsAddingHoliday(true);
    try {
      await dispatch(
        addHolidayEvent({
          name: holidayForm.name,
          country: holidayForm.country || null,
          start_date: holidayForm.start_date,
          end_date: holidayForm.end_date,
          multiplier: holidayForm.multiplier,
        })
      ).unwrap();
      toast.success('Holiday event added successfully.');
      setShowHolidayModal(false);
      setHolidayForm({ name: '', country: '', start_date: '', end_date: '', multiplier: '1.20' });
      dispatch(fetchHolidayEvents());
    } catch (err) {
      toast.error(typeof err === 'string' ? err : 'Failed to add holiday event.');
    } finally {
      setIsAddingHoliday(false);
    }
  };

  // Handle Remove Holiday Event
  const handleRemoveHoliday = async (id) => {
    if (!window.confirm('Are you sure you want to delete this holiday event?')) return;
    try {
      await dispatch(removeHolidayEvent(id)).unwrap();
      toast.success('Holiday event removed.');
      dispatch(fetchHolidayEvents());
    } catch (err) {
      toast.error(typeof err === 'string' ? err : 'Failed to delete holiday event.');
    }
  };

  const formatDate = (isoString) => {
    if (!isoString) return '—';
    const date = new Date(isoString);
    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const totalLogPages = logsCount ? Math.ceil(logsCount / ADMIN_PAGE_SIZE) : 1;

  return (
    <div className="admin-page">
      <div className="admin-container">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="admin-page-title flex items-center gap-2 text-2xl font-black text-slate-900">
              <TrendingUp size={28} className="text-amber-600" /> Dynamic Pricing Engine
            </h1>
            <p className="admin-page-subtitle text-xs text-slate-500 font-medium mt-1">
              Configure algorithmic fare adjustments, simulate dynamic pricing, manage holiday events, and audit calculation logs.
            </p>
          </div>

          <button
            onClick={handleEvaluateAll}
            disabled={isEvaluating}
            className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-slate-950 font-extrabold text-xs px-5 py-3 rounded-2xl shadow-lg shadow-amber-500/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
          >
            {isEvaluating ? (
              <>
                <SpinnerLoader size={14} /> Re-evaluating...
              </>
            ) : (
              <>
                <Zap size={16} /> Re-evaluate All Fares
              </>
            )}
          </button>
        </div>

        {/* Section 1: Engine Config & Simulator Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-10">
          {/* Global Configuration Card (5 Cols) */}
          <div className="lg:col-span-5 bg-white/80 backdrop-blur-xl border border-slate-200/80 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
                <div className="flex items-center gap-2">
                  <Settings size={20} className="text-slate-700" />
                  <h2 className="text-base font-extrabold text-slate-900">Engine Configuration</h2>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={configForm.is_enabled}
                    onChange={(e) => setConfigForm({ ...configForm, is_enabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                  <span className="ml-2.5 text-xs font-bold text-slate-700">
                    {configForm.is_enabled ? 'Active' : 'Disabled'}
                  </span>
                </label>
              </div>

              {configLoading ? (
                <div className="py-12 flex justify-center">
                  <SpinnerLoader />
                </div>
              ) : (
                <form onSubmit={handleSaveConfig} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">
                        Weekend Multiplier
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="1.00"
                        max="3.00"
                        value={configForm.weekend_multiplier}
                        onChange={(e) => setConfigForm({ ...configForm, weekend_multiplier: e.target.value })}
                        className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-400 outline-none"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">
                        Holiday Multiplier
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="1.00"
                        max="3.00"
                        value={configForm.holiday_multiplier}
                        onChange={(e) => setConfigForm({ ...configForm, holiday_multiplier: e.target.value })}
                        className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-400 outline-none"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">
                        Surge / Booking
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.00"
                        max="0.50"
                        value={configForm.demand_surge_per_booking}
                        onChange={(e) =>
                          setConfigForm({ ...configForm, demand_surge_per_booking: e.target.value })
                        }
                        className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-400 outline-none"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">
                        Max Surge Cap
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="1.00"
                        max="5.00"
                        value={configForm.max_surge_cap}
                        onChange={(e) => setConfigForm({ ...configForm, max_surge_cap: e.target.value })}
                        className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-400 outline-none"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">
                      Demand Velocity Window (Days)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="30"
                      value={configForm.demand_window_days}
                      onChange={(e) => setConfigForm({ ...configForm, demand_window_days: e.target.value })}
                      className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-400 outline-none"
                      required
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isSavingConfig}
                      className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-black text-white font-bold text-xs py-2.5 rounded-xl transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isSavingConfig ? <SpinnerLoader size={14} /> : <CheckCircle2 size={14} />} Save Parameters
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>

          {/* Pricing Simulator Card (7 Cols) */}
          <div className="lg:col-span-7 bg-white/80 backdrop-blur-xl border border-slate-200/80 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 pb-4 border-b border-slate-100 mb-5">
                <Sparkles size={20} className="text-amber-500" />
                <h2 className="text-base font-extrabold text-slate-900">Pricing Simulator</h2>
              </div>

              <form onSubmit={handleRunSimulation} className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Route Fare Template</label>
                  <select
                    value={simForm.route_fare_id}
                    onChange={(e) => setSimForm({ ...simForm, route_fare_id: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-400 outline-none"
                    required
                  >
                    <option value="">Select Route Fare...</option>
                    {routeFares?.map((rf) => (
                      <option key={rf.id} value={rf.id}>
                        {rf.flight_no ? `Flight ${rf.flight_no}` : `Route #${rf.route}`} ({rf.fare_code} - {rf.cabin_class})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Target Flight Date</label>
                  <input
                    type="date"
                    value={simForm.flight_date}
                    onChange={(e) => setSimForm({ ...simForm, flight_date: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-400 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Hypothetical Bookings</label>
                  <input
                    type="number"
                    min="0"
                    max="500"
                    value={simForm.mock_booking_count}
                    onChange={(e) => setSimForm({ ...simForm, mock_booking_count: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-400 outline-none"
                    required
                  />
                </div>

                <div className="md:col-span-3 flex justify-end">
                  <button
                    type="submit"
                    disabled={isSimulating}
                    className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs px-5 py-2.5 rounded-xl transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isSimulating ? <SpinnerLoader size={14} /> : <Play size={14} />} Run Simulation
                  </button>
                </div>
              </form>

              {/* Simulation Result Preview */}
              {simResult && (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 animate-fade-in">
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-amber-500/20">
                    <span className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                      Simulation Breakdown
                    </span>
                    <span className="text-sm font-black text-amber-700 tabular-nums">
                      Final: {simResult.currency || 'INR'} {Number(simResult.final_calculated_price ?? simResult.final_price ?? 0).toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <div className="bg-white/80 p-2.5 rounded-xl border border-amber-200/60">
                      <span className="text-[10px] text-slate-500 block font-medium">Base Fare</span>
                      <strong className="text-slate-800 font-bold tabular-nums">
                        {simResult.currency || 'INR'} {Number(simResult.base_price || 0).toLocaleString('en-IN')}
                      </strong>
                    </div>

                    <div className="bg-white/80 p-2.5 rounded-xl border border-amber-200/60">
                      <span className="text-[10px] text-slate-500 block font-medium">Weekend Surge</span>
                      <strong className="text-slate-800">
                        {simResult.weekend_multiplier ? `${simResult.weekend_multiplier}x` : '1.00x'}
                      </strong>
                    </div>

                    <div className="bg-white/80 p-2.5 rounded-xl border border-amber-200/60">
                      <span className="text-[10px] text-slate-500 block font-medium">Holiday Surge</span>
                      <strong className="text-slate-800">
                        {simResult.holiday_name ? `${simResult.holiday_multiplier}x (${simResult.holiday_name})` : (simResult.holiday_applied ? `${simResult.holiday_multiplier}x (${simResult.holiday_applied})` : '1.00x')}
                      </strong>
                    </div>

                    <div className="bg-white/80 p-2.5 rounded-xl border border-amber-200/60">
                      <span className="text-[10px] text-slate-500 block font-medium">Total Surge Cap</span>
                      <strong className="text-slate-800">
                        {simResult.combined_multiplier !== undefined && simResult.combined_multiplier !== null
                          ? `${simResult.combined_multiplier}x`
                          : (Number(simResult.base_price) > 0
                              ? `${(Number(simResult.final_price ?? simResult.final_calculated_price ?? 0) / Number(simResult.base_price)).toFixed(2)}x`
                              : '1.00x')}
                      </strong>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Section 2: Holiday Events Management */}
        <div className="bg-white/80 backdrop-blur-xl border border-slate-200/80 rounded-3xl p-6 shadow-sm mb-10">
          <div className="flex justify-between items-center pb-4 border-b border-slate-100 mb-5">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Calendar size={20} className="text-amber-600" /> Holiday & Peak Travel Events
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Define peak festival periods and country-specific holidays that trigger price surges.
              </p>
            </div>

            <button
              onClick={() => setShowHolidayModal(true)}
              className="flex items-center gap-1.5 bg-slate-900 hover:bg-black text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all cursor-pointer"
            >
              <Plus size={14} /> Add Holiday Event
            </button>
          </div>

          {holidaysLoading ? (
            <div className="py-8 flex justify-center">
              <SpinnerLoader />
            </div>
          ) : holidays?.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs font-semibold">
              No holiday events configured. Click "Add Holiday Event" to create one.
            </div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Event Name</th>
                    <th>Country Filter</th>
                    <th>Start Date</th>
                    <th>End Date</th>
                    <th>Multiplier</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {holidays.map((h) => (
                    <tr key={h.id} className="admin-row">
                      <td className="font-bold text-slate-900 text-xs">{h.name}</td>
                      <td>
                        <span className="text-xs font-semibold text-slate-700">
                          {h.country_name || (h.country ? `Country #${h.country}` : 'Global (All Countries)')}
                        </span>
                      </td>
                      <td className="text-xs font-medium text-slate-600 tabular-nums">{h.start_date}</td>
                      <td className="text-xs font-medium text-slate-600 tabular-nums">{h.end_date}</td>
                      <td>
                        <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 tabular-nums">
                          {h.multiplier}x
                        </span>
                      </td>
                      <td className="text-right">
                        <button
                          onClick={() => handleRemoveHoliday(h.id)}
                          className="text-rose-500 hover:text-rose-700 p-1.5 rounded-lg hover:bg-rose-50 transition-colors"
                          title="Delete Holiday"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Section 3: Dynamic Price Audit Logs */}
        <div className="bg-white/80 backdrop-blur-xl border border-slate-200/80 rounded-3xl p-6 shadow-sm">
          <div className="flex justify-between items-center pb-4 border-b border-slate-100 mb-5">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <History size={20} className="text-slate-700" /> Dynamic Price Audit Logs
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                {logsCount || 0} automated pricing adjustments logged by the strategy engine.
              </p>
            </div>
          </div>

          <div className="admin-table-wrap">
            {logsLoading ? (
              <div className="py-12 flex justify-center">
                <SpinnerLoader />
              </div>
            ) : logs?.length === 0 ? (
              <div className="admin-empty py-10 text-center">
                <History size={28} className="mx-auto text-slate-300 mb-2" />
                <h3 className="text-sm font-bold text-slate-700">No dynamic pricing logs found</h3>
                <p className="text-xs text-slate-500">
                  Logs will be generated automatically as bookings occur or manual re-evaluations are run.
                </p>
              </div>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Flight Instance</th>
                    <th>Cabin Class</th>
                    <th>Old Price</th>
                    <th>Calculated New Price</th>
                    <th>Trigger Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => {
                    const oldP = Number(log.base_price || 0);
                    const newP = Number(log.final_calculated_price || 0);
                    const curr = log.currency || 'INR';

                    return (
                      <tr key={log.id} className="admin-row">
                        <td className="whitespace-nowrap text-xs font-semibold text-slate-600 flex items-center gap-1.5 pt-3.5">
                          <Clock size={13} className="text-slate-400" />
                          {formatDate(log.calculated_at)}
                        </td>
                        <td>
                          <div className="flex flex-col">
                            <strong className="text-xs text-slate-900 font-bold flex items-center gap-1">
                              <Plane size={12} className="text-slate-400" />
                              {log.flight_no ? `Flight ${log.flight_no}` : (log.flight_instance ? `Instance #${log.flight_instance}` : '—')}
                            </strong>
                            {log.flight_date && (
                              <span className="text-[11px] text-slate-500 font-medium pl-4">
                                {log.flight_date}
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                            log.cabin_class === 'FIRST' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                            log.cabin_class === 'BUSINESS' ? 'bg-purple-100 text-purple-800 border border-purple-300' :
                            'bg-blue-100 text-blue-800 border border-blue-300'
                          }`}>
                            {log.cabin_class || 'ECONOMY'}
                          </span>
                        </td>
                        <td className="text-xs font-semibold text-slate-500 tabular-nums">
                          {curr} {oldP.toLocaleString('en-IN')}
                        </td>
                        <td className="text-xs font-bold text-slate-900 tabular-nums">
                          {curr} {newP.toLocaleString('en-IN')}
                        </td>
                        <td className="text-xs text-slate-600 font-medium">
                          {log.trigger_reason || 'Periodic Evaluation'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <Pagination
            currentPage={logPage}
            totalPages={totalLogPages}
            totalCount={logsCount || logs?.length || 0}
            pageSize={ADMIN_PAGE_SIZE}
            onPageChange={(p) => setLogPage(p)}
            entityLabel="audit logs"
          />
        </div>
      </div>

      {/* Add Holiday Event Modal */}
      {showHolidayModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-scale-up">
            <h3 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-2">
              <Calendar size={20} className="text-amber-600" /> Add Holiday Event
            </h3>

            <form onSubmit={handleAddHoliday} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Event Name</label>
                <input
                  type="text"
                  value={holidayForm.name}
                  onChange={(e) => setHolidayForm({ ...holidayForm, name: e.target.value })}
                  placeholder="e.g. Diwali Peak Week"
                  className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-400 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Country Scope (Optional)</label>
                <select
                  value={holidayForm.country}
                  onChange={(e) => setHolidayForm({ ...holidayForm, country: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-400 outline-none"
                >
                  <option value="">Global (All Countries)</option>
                  {countries?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.iso_code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={holidayForm.start_date}
                    onChange={(e) => setHolidayForm({ ...holidayForm, start_date: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-400 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">End Date</label>
                  <input
                    type="date"
                    value={holidayForm.end_date}
                    onChange={(e) => setHolidayForm({ ...holidayForm, end_date: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-400 outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Holiday Multiplier</label>
                <input
                  type="number"
                  step="0.01"
                  min="1.00"
                  max="3.00"
                  value={holidayForm.multiplier}
                  onChange={(e) => setHolidayForm({ ...holidayForm, multiplier: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-400 outline-none"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowHolidayModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAddingHoliday}
                  className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs px-4 py-2 rounded-xl transition-all cursor-pointer disabled:opacity-50"
                >
                  {isAddingHoliday ? <SpinnerLoader size={14} /> : <Plus size={14} />} Create Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
