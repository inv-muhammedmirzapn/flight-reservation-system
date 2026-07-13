import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, Link } from 'react-router-dom';
import { fetchFlightDetail, clearFlightDetail } from '../../store/flightSlice';
import { Plane, Calendar, DollarSign, Users, ArrowLeft, Clock, ShieldCheck, Tag } from 'lucide-react';

export default function UserFlightDetail() {
  const { id } = useParams();
  const dispatch = useDispatch();
  const { detail: flight, detailLoading, error } = useSelector((state) => state.flights);

  useEffect(() => {
    dispatch(fetchFlightDetail(id));
    return () => {
      dispatch(clearFlightDetail());
    };
  }, [dispatch, id]);

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'SCHEDULED':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'DELAYED':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'CANCELLED':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'BOARDING':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'DEPARTED':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'ARRIVED':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getDuration = (dep, arr) => {
    try {
      const diff = new Date(arr) - new Date(dep);
      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      return `${hours}h ${minutes}m`;
    } catch (_) {
      return 'N/A';
    }
  };

  if (detailLoading) {
    return (
      <div className="flex justify-center items-center py-20 min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full max-w-[800px] mx-auto px-4 py-8">
        <div className="glass-card rounded-2xl p-6 border-red-200 bg-red-50 text-red-700 text-center mb-6">
          <p>{error}</p>
        </div>
        <Link to="/flights" className="inline-flex items-center gap-2 text-primary font-bold hover:underline">
          <ArrowLeft className="w-5 h-5" /> Back to Flights
        </Link>
      </div>
    );
  }

  if (!flight) return null;

  return (
    <div className="w-full max-w-[800px] mx-auto px-4 py-8">
      {/* Back Button */}
      <Link 
        to="/flights" 
        className="inline-flex items-center gap-2 mb-6 font-display-bold text-display-bold text-on-surface hover:text-primary transition-all duration-300 active:scale-95 group font-bold"
      >
        <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" /> 
        Back to Listings
      </Link>

      {/* Detail Glass Card */}
      <div className="glass-card rounded-[2.5rem] p-8 md:p-12 relative overflow-hidden flex flex-col gap-8">
        {/* Glow */}
        <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-primary-container blur-3xl opacity-20 pointer-events-none"></div>

        {/* Top Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b border-black/5 dark:border-white/10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Plane className="w-6 h-6 text-primary" />
              <h1 className="text-2xl md:text-3xl font-black text-on-surface">{flight.flight_number}</h1>
            </div>
            <p className="text-body-md text-on-surface-variant">{flight.airline} &bull; {flight.aircraft}</p>
          </div>

          <span className={`px-4 py-1.5 rounded-full text-sm font-bold border ${getStatusBadgeClass(flight.status)}`}>
            {flight.status}
          </span>
        </div>

        {/* Route Details */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center text-center md:text-left">
          {/* Source */}
          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase font-extrabold tracking-wider text-on-surface-variant">Departure</span>
            <span className="text-4xl font-black text-on-surface">{flight.source_airport}</span>
            <span className="text-sm font-semibold text-on-surface-variant">
              {new Date(flight.departure_time).toLocaleDateString()}
            </span>
            <span className="text-xs text-on-surface-variant">
              {new Date(flight.departure_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          {/* Icon & Duration */}
          <div className="flex flex-col items-center justify-center gap-2">
            <span className="text-xs text-on-surface-variant font-semibold flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-primary" />
              {getDuration(flight.departure_time, flight.arrival_time)}
            </span>
            <div className="relative w-full flex items-center justify-center">
              <div className="absolute w-full h-[2px] bg-primary/20"></div>
              <div className="bg-white/90 p-2 rounded-full border border-primary/20 z-10">
                <Plane className="w-5 h-5 text-primary rotate-90 md:rotate-0" />
              </div>
            </div>
          </div>

          {/* Destination */}
          <div className="flex flex-col gap-1 md:text-right">
            <span className="text-xs uppercase font-extrabold tracking-wider text-on-surface-variant">Arrival</span>
            <span className="text-4xl font-black text-on-surface">{flight.destination_airport}</span>
            <span className="text-sm font-semibold text-on-surface-variant">
              {new Date(flight.arrival_time).toLocaleDateString()}
            </span>
            <span className="text-xs text-on-surface-variant">
              {new Date(flight.arrival_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-6 border-t border-black/5 dark:border-white/10">
          <div className="flex items-center gap-4 bg-white/40 border border-white/60 p-4 rounded-2xl">
            <DollarSign className="w-8 h-8 text-primary" />
            <div>
              <p className="text-xs font-bold uppercase text-on-surface-variant">Base Fare</p>
              <p className="text-xl font-extrabold text-on-surface">${flight.base_fare}</p>
            </div>
          </div>

          <div className="flex items-center gap-4 bg-white/40 border border-white/60 p-4 rounded-2xl">
            <Users className="w-8 h-8 text-primary" />
            <div>
              <p className="text-xs font-bold uppercase text-on-surface-variant">Available Seats</p>
              <p className="text-xl font-extrabold text-on-surface">
                {flight.available_seats} <span className="text-sm font-normal text-on-surface-variant">/ {flight.total_seats}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Extras / Badges */}
        <div className="flex flex-wrap gap-3 mt-4">
          <div className="flex items-center gap-1.5 px-3.5 py-1.5 bg-primary/10 border border-primary/20 rounded-xl text-xs font-bold text-primary">
            <ShieldCheck className="w-4 h-4" /> Refundable Ticket
          </div>
          <div className="flex items-center gap-1.5 px-3.5 py-1.5 bg-primary/10 border border-primary/20 rounded-xl text-xs font-bold text-primary">
            <Tag className="w-4 h-4" /> Best Price Guarantee
          </div>
        </div>
      </div>
    </div>
  );
}
