import { useState, useCallback, useEffect, useRef } from 'react';
import {
  fetchAnalyticsSummary, fetchMonthlyRevenue, fetchPopularRoutes,
  fetchFlightOccupancy, fetchPeakBookingHours,
  fetchAirlinePerformance, fetchAircraftUtilization,
} from '@/services/analytics-service';
import { parseApiError } from '@/utils/errorUtils';

const REFRESH_INTERVAL_MS = 30_000;

export default function useAnalyticsData() {
  const [summary, setSummary] = useState(null);
  const [monthly, setMonthly] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [occupancy, setOccupancy] = useState([]);
  const [peakHours, setPeakHours] = useState([]);
  const [airlinePerf, setAirlinePerf] = useState([]);
  const [aircraftUtil, setAircraftUtil] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({});
  const intervalRef = useRef(null);

  const load = useCallback(async (isSilent = false, f = {}) => {
    if (!isSilent) setLoading(true);
    setError(null);
    try {
      const dateFilters = { startDate: f.startDate, endDate: f.endDate, airlineId: f.airlineId, aircraftId: f.aircraftId };
      const [s, m, r, o, p, ap, au] = await Promise.all([
        fetchAnalyticsSummary(dateFilters),
        fetchMonthlyRevenue(12, dateFilters),
        fetchPopularRoutes(10, dateFilters),
        fetchFlightOccupancy(15, dateFilters),
        fetchPeakBookingHours(dateFilters),
        fetchAirlinePerformance(10, { startDate: f.startDate, endDate: f.endDate }),
        fetchAircraftUtilization(10, { startDate: f.startDate, endDate: f.endDate }),
      ]);
      setSummary(s); setMonthly(m); setRoutes(r); setOccupancy(o); setPeakHours(p);
      setAirlinePerf(ap); setAircraftUtil(au);
    } catch (err) {
      if (!isSilent) setError(parseApiError(err, 'Failed to load analytics data.'));
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(false, filters);
    intervalRef.current = setInterval(() => load(true, filters), REFRESH_INTERVAL_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') load(true, filters); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(intervalRef.current); document.removeEventListener('visibilitychange', onVisible); };
  }, [load, filters]);

  const handleFilterChange = useCallback((f) => { setFilters(f); load(false, f); }, [load]);

  return {
    summary,
    monthly,
    routes,
    occupancy,
    peakHours,
    airlinePerf,
    aircraftUtil,
    loading,
    error,
    filters,
    load,
    handleFilterChange,
  };
}
