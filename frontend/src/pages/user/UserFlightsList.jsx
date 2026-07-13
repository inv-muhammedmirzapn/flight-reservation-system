import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { fetchFlights } from '../../store/flightSlice';
import { Plane, Search, Calendar, DollarSign, Users, Info } from 'lucide-react';

export default function UserFlightsList() {
  const dispatch = useDispatch();
  const { list: flights, loading, error } = useSelector((state) => state.flights);
  
  // Local filter states
  const [source, setSource] = useState('');
  const [destination, setDestination] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    dispatch(fetchFlights());
  }, [dispatch]);

  const filteredFlights = flights.filter(flight => {
    const matchSource = !source || flight.source_airport.toLowerCase().includes(source.toLowerCase());
    const matchDest = !destination || flight.destination_airport.toLowerCase().includes(destination.toLowerCase());
    const matchStatus = !statusFilter || flight.status === statusFilter;
    return matchSource && matchDest && matchStatus;
  });

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

  return (
    <div className="w-full max-w-[1200px] mx-auto px-4 py-8">
      {/* Header Banner */}
      <div className="glass-card rounded-[2rem] p-8 md:p-12 mb-8 text-center flex flex-col gap-4 relative overflow-hidden">
        <div className="absolute -top-10 -left-10 w-40 h-40 rounded-full bg-primary-container blur-3xl opacity-20 pointer-events-none"></div>
        <div className="absolute -bottom-10 -right-10 w-40 h-40 rounded-full bg-white blur-3xl opacity-40 pointer-events-none"></div>
        
        <h1 className="text-4xl md:text-5xl font-black tracking-tight text-on-surface">
          Explore Flight Paths
        </h1>
        <p className="text-body-md text-on-surface-variant max-w-xl mx-auto">
          Search and track flights globally. Experience luxury flight details with AeroGlass.
        </p>
      </div>

      {/* Filters Section */}
      <div className="glass-card rounded-3xl p-6 mb-8 grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
        <div className="relative flex items-center bg-white/40 border border-white/60 rounded-xl px-4 py-2">
          <Search className="w-5 h-5 text-on-surface-variant mr-2" />
          <input 
            type="text" 
            placeholder="From (e.g. JFK)" 
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="w-full bg-transparent border-none outline-none focus:ring-0 text-on-surface font-body-md"
          />
        </div>

        <div className="relative flex items-center bg-white/40 border border-white/60 rounded-xl px-4 py-2">
          <Search className="w-5 h-5 text-on-surface-variant mr-2" />
          <input 
            type="text" 
            placeholder="To (e.g. LAX)" 
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            className="w-full bg-transparent border-none outline-none focus:ring-0 text-on-surface font-body-md"
          />
        </div>

        <div className="relative bg-white/40 border border-white/60 rounded-xl px-4 py-2">
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full bg-transparent border-none outline-none focus:ring-0 text-on-surface font-body-md appearance-none cursor-pointer"
          >
            <option value="">All Statuses</option>
            <option value="SCHEDULED">Scheduled</option>
            <option value="DELAYED">Delayed</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="BOARDING">Boarding</option>
            <option value="DEPARTED">Departed</option>
            <option value="ARRIVED">Arrived</option>
          </select>
        </div>
      </div>

      {/* Flight Cards Grid */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : error ? (
        <div className="glass-card rounded-2xl p-6 border-red-200 bg-red-50 text-red-700 text-center">
          <p>{error}</p>
        </div>
      ) : filteredFlights.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center text-on-surface-variant">
          <Plane className="w-12 h-12 mx-auto mb-4 opacity-40 text-on-surface" />
          <p className="font-semibold text-lg">No flights found matching criteria.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredFlights.map((flight) => (
            <Link 
              key={flight.id} 
              to={`/flights/${flight.id}`}
              className="glass-card rounded-3xl p-6 flex flex-col justify-between border border-white/60 hover:-translate-y-1 hover:shadow-xl transition-all duration-300"
            >
              <div>
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-2">
                    <Plane className="w-5 h-5 text-primary" />
                    <span className="font-bold text-on-surface">{flight.flight_number}</span>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusBadgeClass(flight.status)}`}>
                    {flight.status}
                  </span>
                </div>

                <div className="text-xl font-extrabold text-on-surface mb-2 flex items-center gap-2">
                  <span>{flight.source_airport}</span>
                  <span className="text-primary font-light">→</span>
                  <span>{flight.destination_airport}</span>
                </div>

                <div className="text-xs text-on-surface-variant font-medium mb-4">
                  {flight.airline} &bull; {flight.aircraft}
                </div>

                <div className="flex flex-col gap-2 border-t border-white/20 pt-4 text-sm text-on-surface-variant">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-primary" />
                    <span>Dep: {new Date(flight.departure_time).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-primary" />
                    <span>Arr: {new Date(flight.arrival_time).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center mt-6 pt-4 border-t border-white/20">
                <div className="flex items-center gap-1">
                  <DollarSign className="w-5 h-5 text-primary" />
                  <span className="text-2xl font-black text-on-surface">{flight.base_fare}</span>
                </div>

                <div className="flex items-center gap-2 text-xs font-semibold text-on-surface-variant">
                  <Users className="w-4 h-4 text-primary" />
                  <span>{flight.available_seats} / {flight.total_seats} seats</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
