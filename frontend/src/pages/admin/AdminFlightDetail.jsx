import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { fetchFlightDetail, patchFlight, clearFlightDetail } from '../../store/flightSlice';
import { Plane, Calendar, DollarSign, Users, ArrowLeft, Edit2, ShieldAlert, Award, Clock } from 'lucide-react';
import { Select } from '../../components/ui/Select';

const statusOptions = [
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'DELAYED', label: 'Delayed' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'BOARDING', label: 'Boarding' },
  { value: 'DEPARTED', label: 'Departed' },
  { value: 'ARRIVED', label: 'Arrived' }
];

export default function AdminFlightDetail() {
  const { id } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { detail: flight, detailLoading, actionLoading, error } = useSelector((state) => state.flights);

  const [statusVal, setStatusVal] = useState('SCHEDULED');

  useEffect(() => {
    dispatch(fetchFlightDetail(id));
    return () => {
      dispatch(clearFlightDetail());
    };
  }, [dispatch, id]);

  useEffect(() => {
    if (flight) {
      setStatusVal(flight.status);
    }
  }, [flight]);

  const handleStatusChange = async (e) => {
    const nextStatus = e.target.value;
    setStatusVal(nextStatus);
    await dispatch(patchFlight({ id, flightData: { status: nextStatus } }));
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'SCHEDULED': return 'text-emerald-700 bg-emerald-50 border-emerald-200';
      case 'DELAYED': return 'text-amber-700 bg-amber-50 border-amber-200';
      case 'CANCELLED': return 'text-rose-700 bg-rose-50 border-rose-200';
      default: return 'text-blue-700 bg-blue-50 border-blue-200';
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
        <div className="bg-rose-50 text-rose-700 p-4 border border-rose-200 rounded-xl mb-6">
          {error}
        </div>
        <Link to="/admin/flights" className="inline-flex items-center gap-2 text-on-surface font-bold hover:underline">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>
      </div>
    );
  }

  if (!flight) return null;

  return (
    <div className="w-full max-w-[800px] mx-auto px-4 py-8">
      {/* Back Button */}
      <Link 
        to="/admin/flights" 
        className="inline-flex items-center gap-2 mb-6 font-bold text-on-surface hover:text-[#555] transition-all"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Console
      </Link>

      {/* Main Admin Card */}
      <div className="bg-white rounded-3xl border border-black/5 p-8 shadow-sm flex flex-col gap-6">
        
        {/* Title / Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b border-black/5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gray-100 rounded-2xl">
              <Plane className="w-6 h-6 text-on-surface" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-on-surface">{flight.flight_number}</h1>
              <p className="text-sm text-on-surface-variant">{flight.airline} &bull; {flight.aircraft}</p>
            </div>
          </div>

          <div className="w-48">
            <Select 
              id="detail-status" 
              label="Quick Status Edit" 
              options={statusOptions} 
              value={statusVal}
              onChange={handleStatusChange} 
              disabled={actionLoading}
            />
          </div>
        </div>

        {/* Route / Path Display */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center border-b border-black/5 pb-6">
          <div className="text-center md:text-left">
            <p className="text-xs uppercase font-bold text-on-surface-variant">Departure (IATA)</p>
            <p className="text-3xl font-black text-on-surface">{flight.source_airport}</p>
            <p className="text-sm text-on-surface-variant font-medium mt-1">
              {new Date(flight.departure_time).toLocaleString()}
            </p>
          </div>

          <div className="flex flex-col items-center justify-center">
            <div className="w-full relative flex items-center justify-center">
              <div className="absolute w-full h-[1px] bg-black/10"></div>
              <div className="bg-gray-50 border border-black/5 px-4 py-1.5 rounded-full text-xs font-bold text-on-surface-variant z-10">
                Non-stop
              </div>
            </div>
          </div>

          <div className="text-center md:text-right">
            <p className="text-xs uppercase font-bold text-on-surface-variant">Arrival (IATA)</p>
            <p className="text-3xl font-black text-on-surface">{flight.destination_airport}</p>
            <p className="text-sm text-on-surface-variant font-medium mt-1">
              {new Date(flight.arrival_time).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-50 border border-black/5 p-5 rounded-2xl flex items-center gap-4">
            <DollarSign className="w-8 h-8 text-primary" />
            <div>
              <p className="text-xs font-bold uppercase text-on-surface-variant">Base Fare</p>
              <p className="text-xl font-extrabold text-on-surface">${flight.base_fare}</p>
            </div>
          </div>

          <div className="bg-gray-50 border border-black/5 p-5 rounded-2xl flex items-center gap-4">
            <Users className="w-8 h-8 text-primary" />
            <div>
              <p className="text-xs font-bold uppercase text-on-surface-variant">Available Seats</p>
              <p className="text-xl font-extrabold text-on-surface">{flight.available_seats}</p>
            </div>
          </div>

          <div className="bg-gray-50 border border-black/5 p-5 rounded-2xl flex items-center gap-4">
            <Users className="w-8 h-8 text-primary" />
            <div>
              <p className="text-xs font-bold uppercase text-on-surface-variant">Total Seats</p>
              <p className="text-xl font-extrabold text-on-surface">{flight.total_seats}</p>
            </div>
          </div>
        </div>

        {/* System Meta Info */}
        <div className="mt-4 bg-gray-50 border border-black/5 rounded-2xl p-5 flex flex-col gap-3 text-xs text-on-surface-variant">
          <p className="font-bold text-sm text-on-surface mb-1">System Metadata</p>
          <div className="flex justify-between">
            <span>External Sync ID:</span>
            <span className="font-semibold text-on-surface">{flight.external_id || 'N/A'}</span>
          </div>
          <div className="flex justify-between">
            <span>Sync Source:</span>
            <span className="font-semibold text-on-surface">{flight.sync_source || 'Local Database'}</span>
          </div>
        </div>

      </div>
    </div>
  );
}
