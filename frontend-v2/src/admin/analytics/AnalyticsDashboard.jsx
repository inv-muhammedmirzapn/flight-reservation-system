import React from 'react';
import { useTranslation } from 'react-i18next';
import { TrendingUp, Ticket, CheckCircle, XCircle, Percent, AlertCircle } from 'lucide-react';

import AnalyticsFilterBar from './components/AnalyticsFilterBar';
import KpiCard from './components/KpiCard';
import MonthlyRevenueChart from './components/MonthlyRevenueChart';
import PopularRoutesChart from './components/PopularRoutesChart';
import PeakHoursChart from './components/PeakHoursChart';
import FlightOccupancyChart from './components/FlightOccupancyChart';
import AirlinePerformanceChart from './components/AirlinePerformanceChart';
import AircraftUtilizationChart from './components/AircraftUtilizationChart';
import useAnalyticsData from './hooks/useAnalyticsData';
import { INR } from '@/utils/formatters';
import { GOLD_DARK, BLUE, GREEN, RED, AMBER } from './constants';

export default function AnalyticsDashboard() {
  const { t } = useTranslation();
  const {
    summary, monthly, routes, occupancy, peakHours,
    airlinePerf, aircraftUtil, loading, error, filters,
    load, handleFilterChange,
  } = useAnalyticsData();

  return (
    <div className="min-h-screen font-ui pt-[88px] pb-[60px]">
      <div className="w-[95%] max-w-[1800px] mx-auto px-6">

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
          <div>
            <h1 className="font-ui text-2xl font-extrabold text-admin-ink tracking-[-0.02em] m-0 leading-tight">{t('admin.analytics.title')}</h1>
            <p className="text-sm text-admin-muted mt-1 mb-0">{t('admin.analytics.subtitle')}</p>
          </div>
        </div>

        {/* ── Error Banner ── */}
        {error && (
          <div className="flex items-center gap-3 bg-status-red-bg border border-status-red-bg text-status-red p-4 rounded-admin-lg mb-6 font-ui text-sm">
            <AlertCircle size={18} />
            <span>{error}</span>
            <button className="font-bold underline cursor-pointer bg-transparent border-none p-0 ml-auto transition-opacity hover:opacity-70 text-status-red" onClick={() => load(false, filters)}>{t('admin.analytics.retry')}</button>
          </div>
        )}

        {/* ── Filter Bar ── */}
        <AnalyticsFilterBar onFilterChange={handleFilterChange} disabled={loading} />

        {/* ── KPI Grid ── */}
        <div className="grid mb-6 grid-cols-2 gap-[10px] sm:grid-cols-3 sm:gap-4 lg:grid-cols-5 lg:gap-3 xl:gap-4">
          <KpiCard icon={<TrendingUp size={20} color={GOLD_DARK} />} label={t('admin.analytics.kpi.totalRevenue')} value={summary ? INR(summary.total_revenue) : '—'} sub={t('admin.analytics.kpi.revenueSub')} accent={GOLD_DARK} loading={loading}
            tooltip={summary ? `Exact: ${new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(summary.total_revenue)}` : undefined} />
          <KpiCard icon={<Ticket size={20} color={BLUE} />} label={t('admin.analytics.kpi.totalBookings')} value={summary ? summary.total_bookings.toLocaleString() : '—'} sub={t('admin.analytics.kpi.bookingsSub')} accent={BLUE} loading={loading} />
          <KpiCard icon={<CheckCircle size={20} color={GREEN} />} label={t('admin.analytics.kpi.confirmed')} value={summary ? summary.confirmed_bookings.toLocaleString() : '—'} sub={t('admin.analytics.kpi.confirmedSub')} accent={GREEN} loading={loading} />
          <KpiCard icon={<XCircle size={20} color={RED} />} label={t('admin.analytics.kpi.cancelled')} value={summary ? summary.cancelled_bookings.toLocaleString() : '—'} sub={t('admin.analytics.kpi.cancelledSub')} accent={RED} loading={loading} />
          <KpiCard icon={<Percent size={20} color={AMBER} />} label={t('admin.analytics.kpi.cancellationRate')} value={summary ? `${summary.cancellation_rate}%` : '—'} sub={t('admin.analytics.kpi.rateSub')} accent={AMBER} loading={loading} />
        </div>

        {/* ── Row 1: Monthly Revenue + Popular Routes ── */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 mb-5">
          <MonthlyRevenueChart data={monthly} loading={loading} title={t('admin.analytics.charts.monthlyRevenue')} />
          <PopularRoutesChart data={routes} loading={loading} title={t('admin.analytics.charts.popularRoutes')} />
        </div>

        {/* ── Row 2: Peak Hours + Flight Occupancy ── */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 mb-5">
          <PeakHoursChart data={peakHours} loading={loading} title={t('admin.analytics.charts.peakHours')} />
          <FlightOccupancyChart data={occupancy} loading={loading} title={t('admin.analytics.charts.flightOccupancy')} />
        </div>

        {/* ── Row 3: Airline Performance + Aircraft Utilization ── */}
        {!(filters.airlineId || filters.aircraftId) && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 mb-5">
            <AirlinePerformanceChart data={airlinePerf} loading={loading} title="Airline Performance" />
            <AircraftUtilizationChart data={aircraftUtil} loading={loading} title="Aircraft Utilization" />
          </div>
        )}

      </div>
    </div>
  );
}