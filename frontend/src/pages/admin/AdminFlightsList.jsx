import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { fetchFlights, addFlight, updateFlight, clearFlightErrors } from '../../store/flightSlice';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Plus, Edit2, Eye, Plane, Calendar, DollarSign, Users, RefreshCw, AlertCircle } from 'lucide-react';

const emptyFormState = {
  flight_number: '',
  airline: '',
  aircraft: '',
  source_airport: '',
  destination_airport: '',
  departure_time: '',
  arrival_time: '',
  base_fare: '',
  total_seats: '',
  available_seats: '',
  status: 'SCHEDULED'
};

const statusOptions = [
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'DELAYED', label: 'Delayed' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'BOARDING', label: 'Boarding' },
  { value: 'DEPARTED', label: 'Departed' },
  { value: 'ARRIVED', label: 'Arrived' }
];

export default function AdminFlightsList() {
  const dispatch = useDispatch();
  const { list: flights, loading, actionLoading, validationErrors } = useSelector((state) => state.flights);

  // Modal & Form states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFlightId, setEditingFlightId] = useState(null); // null means "Adding"
  const [formData, setFormData] = useState(emptyFormState);
  const [localErrors, setLocalErrors] = useState({});

  useEffect(() => {
    dispatch(fetchFlights());
  }, [dispatch]);

  const handleOpenAddModal = () => {
    dispatch(clearFlightErrors());
    setLocalErrors({});
    setFormData(emptyFormState);
    setEditingFlightId(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (flight) => {
    dispatch(clearFlightErrors());
    setLocalErrors({});
    setFormData({
      flight_number: flight.flight_number,
      airline: flight.airline,
      aircraft: flight.aircraft,
      source_airport: flight.source_airport,
      destination_airport: flight.destination_airport,
      departure_time: flight.departure_time.substring(0, 16), // Format to match datetime-local input
      arrival_time: flight.arrival_time.substring(0, 16),
      base_fare: flight.base_fare,
      total_seats: flight.total_seats,
      available_seats: flight.available_seats,
      status: flight.status
    });
    setEditingFlightId(flight.id);
    setIsModalOpen(true);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    if (localErrors[name]) {
      setLocalErrors({ ...localErrors, [name]: null });
    }
  };

  // Frontend validations
  const validateForm = () => {
    const errors = {};
    if (!formData.flight_number.trim()) errors.flight_number = 'Flight number is required';
    if (!formData.airline.trim()) errors.airline = 'Airline is required';
    if (!formData.aircraft.trim()) errors.aircraft = 'Aircraft is required';
    
    if (!formData.source_airport.trim()) {
      errors.source_airport = 'Source airport is required';
    } else if (formData.source_airport.trim().length !== 3) {
      errors.source_airport = 'Airport code must be 3 characters';
    }
    
    if (!formData.destination_airport.trim()) {
      errors.destination_airport = 'Destination airport is required';
    } else if (formData.destination_airport.trim().length !== 3) {
      errors.destination_airport = 'Airport code must be 3 characters';
    }

    if (formData.source_airport && formData.destination_airport) {
      if (formData.source_airport.trim().toUpperCase() === formData.destination_airport.trim().toUpperCase()) {
        errors.destination_airport = 'Source and destination airports cannot be identical';
      }
    }

    if (!formData.departure_time) errors.departure_time = 'Departure time is required';
    if (!formData.arrival_time) errors.arrival_time = 'Arrival time is required';

    if (formData.departure_time && formData.arrival_time) {
      const depDate = new Date(formData.departure_time);
      const arrDate = new Date(formData.arrival_time);
      if (arrDate <= depDate) {
        errors.arrival_time = 'Arrival time must be after departure time';
      }
    }

    const fare = parseFloat(formData.base_fare);
    if (isNaN(fare) || fare < 0) {
      errors.base_fare = 'Base fare must be a non-negative number';
    }

    const totalSeats = parseInt(formData.total_seats, 10);
    const availSeats = parseInt(formData.available_seats, 10);

    if (isNaN(totalSeats) || totalSeats < 0) {
      errors.total_seats = 'Total seats must be a non-negative integer';
    }
    if (isNaN(availSeats) || availSeats < 0) {
      errors.available_seats = 'Available seats must be a non-negative integer';
    }
    if (!isNaN(totalSeats) && !isNaN(availSeats) && availSeats > totalSeats) {
      errors.available_seats = 'Available seats cannot exceed total seats';
    }

    setLocalErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    // Convert inputs to proper types
    const payload = {
      ...formData,
      source_airport: formData.source_airport.toUpperCase(),
      destination_airport: formData.destination_airport.toUpperCase(),
      base_fare: parseFloat(formData.base_fare).toFixed(2),
      total_seats: parseInt(formData.total_seats, 10),
      available_seats: parseInt(formData.available_seats, 10)
    };

    let result;
    if (editingFlightId) {
      result = await dispatch(updateFlight({ id: editingFlightId, flightData: payload }));
    } else {
      result = await dispatch(addFlight(payload));
    }

    if (result.meta.requestStatus === 'fulfilled') {
      setIsModalOpen(false);
      dispatch(fetchFlights());
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'SCHEDULED': return 'text-emerald-700 bg-emerald-50 border-emerald-200';
      case 'DELAYED': return 'text-amber-700 bg-amber-50 border-amber-200';
      case 'CANCELLED': return 'text-rose-700 bg-rose-50 border-rose-200';
      default: return 'text-blue-700 bg-blue-50 border-blue-200';
    }
  };

  return (
    <div className="w-full max-w-[1200px] mx-auto px-4 py-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-on-surface tracking-tight">Flight Management Console</h1>
          <p className="text-sm text-on-surface-variant">Manage flight routes, seat availabilities, schedules, and statuses.</p>
        </div>

        <button 
          onClick={handleOpenAddModal}
          className="flex items-center gap-2 bg-on-surface text-primary-container px-6 py-3 rounded-xl font-bold hover:bg-[#333] transition-colors duration-300 active:scale-95 shadow-md"
        >
          <Plus className="w-5 h-5" /> Add Flight Route
        </button>
      </div>

      {/* Stats Quick Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-6 rounded-2xl border border-black/5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-on-surface-variant uppercase">Total Routes</p>
            <p className="text-2xl font-black text-on-surface">{flights.length}</p>
          </div>
          <Plane className="w-10 h-10 text-primary opacity-20" />
        </div>

        <div className="bg-white p-6 rounded-2xl border border-black/5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-on-surface-variant uppercase">Scheduled</p>
            <p className="text-2xl font-black text-emerald-700">{flights.filter(f => f.status === 'SCHEDULED').length}</p>
          </div>
          <RefreshCw className="w-10 h-10 text-emerald-500 opacity-20" />
        </div>

        <div className="bg-white p-6 rounded-2xl border border-black/5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-on-surface-variant uppercase">Delayed</p>
            <p className="text-2xl font-black text-amber-700">{flights.filter(f => f.status === 'DELAYED').length}</p>
          </div>
          <AlertCircle className="w-10 h-10 text-amber-500 opacity-20" />
        </div>

        <div className="bg-white p-6 rounded-2xl border border-black/5 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-on-surface-variant uppercase">Cancelled</p>
            <p className="text-2xl font-black text-rose-700">{flights.filter(f => f.status === 'CANCELLED').length}</p>
          </div>
          <AlertCircle className="w-10 h-10 text-rose-500 opacity-20" />
        </div>
      </div>

      {/* Main Flights Table Card */}
      <div className="bg-white rounded-3xl border border-black/5 overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : flights.length === 0 ? (
          <div className="p-12 text-center text-on-surface-variant">
            <Plane className="w-12 h-12 mx-auto mb-4 opacity-40 text-on-surface" />
            <p className="font-semibold text-lg">No flights registered. Click "Add Flight Route" to start.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-black/5 text-xs font-bold uppercase text-on-surface-variant">
                  <th className="p-4 pl-6">Flight No.</th>
                  <th className="p-4">Airline / Aircraft</th>
                  <th className="p-4">Route</th>
                  <th className="p-4">Times (Dep / Arr)</th>
                  <th className="p-4">Fare</th>
                  <th className="p-4">Seats</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 pr-6 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 text-sm text-on-surface font-medium">
                {flights.map((flight) => (
                  <tr key={flight.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="p-4 pl-6 font-bold">{flight.flight_number}</td>
                    <td className="p-4">
                      <div>{flight.airline}</div>
                      <div className="text-xs text-on-surface-variant font-normal">{flight.aircraft}</div>
                    </td>
                    <td className="p-4 font-semibold">
                      {flight.source_airport} <span className="text-primary">→</span> {flight.destination_airport}
                    </td>
                    <td className="p-4 text-xs text-on-surface-variant font-normal">
                      <div>Dep: {new Date(flight.departure_time).toLocaleString()}</div>
                      <div>Arr: {new Date(flight.arrival_time).toLocaleString()}</div>
                    </td>
                    <td className="p-4 font-bold">${flight.base_fare}</td>
                    <td className="p-4 text-xs">
                      <span className="font-bold">{flight.available_seats}</span> / {flight.total_seats}
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${getStatusColor(flight.status)}`}>
                        {flight.status}
                      </span>
                    </td>
                    <td className="p-4 pr-6 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Link 
                          to={`/admin/flights/${flight.id}`}
                          className="p-2 rounded-lg text-on-surface-variant hover:bg-black/5 hover:text-on-surface transition-all active:scale-95"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        <button 
                          onClick={() => handleOpenEditModal(flight)}
                          className="p-2 rounded-lg text-on-surface-variant hover:bg-black/5 hover:text-on-surface transition-all active:scale-95"
                          title="Edit Route"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Modal Form */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingFlightId ? "Edit Flight Route" : "Add Flight Route"}
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          
          {/* Global Backend Error Alert */}
          {validationErrors?.non_field_errors && (
            <div className="p-4 bg-rose-50 text-rose-700 border border-rose-200 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span>{validationErrors.non_field_errors[0]}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Input 
                id="flight_number" 
                name="flight_number"
                label="Flight Number" 
                required 
                value={formData.flight_number} 
                onChange={handleInputChange} 
              />
              {(localErrors.flight_number || validationErrors?.flight_number) && (
                <p className="text-xs text-rose-600 mt-1 pl-1">
                  {localErrors.flight_number || validationErrors.flight_number[0]}
                </p>
              )}
            </div>

            <div>
              <Input 
                id="airline" 
                name="airline"
                label="Airline" 
                required 
                value={formData.airline} 
                onChange={handleInputChange} 
              />
              {(localErrors.airline || validationErrors?.airline) && (
                <p className="text-xs text-rose-600 mt-1 pl-1">
                  {localErrors.airline || validationErrors.airline[0]}
                </p>
              )}
            </div>
          </div>

          <div>
            <Input 
              id="aircraft" 
              name="aircraft"
              label="Aircraft Model" 
              required 
              value={formData.aircraft} 
              onChange={handleInputChange} 
            />
            {(localErrors.aircraft || validationErrors?.aircraft) && (
              <p className="text-xs text-rose-600 mt-1 pl-1">
                {localErrors.aircraft || validationErrors.aircraft[0]}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Input 
                id="source_airport" 
                name="source_airport"
                label="From (IATA Code)" 
                required 
                maxLength={3}
                value={formData.source_airport} 
                onChange={handleInputChange} 
              />
              {(localErrors.source_airport || validationErrors?.source_airport) && (
                <p className="text-xs text-rose-600 mt-1 pl-1">
                  {localErrors.source_airport || validationErrors.source_airport[0]}
                </p>
              )}
            </div>

            <div>
              <Input 
                id="destination_airport" 
                name="destination_airport"
                label="To (IATA Code)" 
                required 
                maxLength={3}
                value={formData.destination_airport} 
                onChange={handleInputChange} 
              />
              {(localErrors.destination_airport || validationErrors?.destination_airport) && (
                <p className="text-xs text-rose-600 mt-1 pl-1">
                  {localErrors.destination_airport || validationErrors.destination_airport[0]}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-on-surface-variant mb-1 pl-1">Departure Time</label>
              <input 
                type="datetime-local" 
                name="departure_time"
                value={formData.departure_time} 
                onChange={handleInputChange} 
                className="w-full bg-white/50 border border-white/60 rounded-xl px-4 py-3 font-body-md text-on-surface outline-none focus:border-primary/50"
                required
              />
              {(localErrors.departure_time || validationErrors?.departure_time) && (
                <p className="text-xs text-rose-600 mt-1 pl-1">
                  {localErrors.departure_time || validationErrors.departure_time[0]}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-on-surface-variant mb-1 pl-1">Arrival Time</label>
              <input 
                type="datetime-local" 
                name="arrival_time"
                value={formData.arrival_time} 
                onChange={handleInputChange} 
                className="w-full bg-white/50 border border-white/60 rounded-xl px-4 py-3 font-body-md text-on-surface outline-none focus:border-primary/50"
                required
              />
              {(localErrors.arrival_time || validationErrors?.arrival_time) && (
                <p className="text-xs text-rose-600 mt-1 pl-1">
                  {localErrors.arrival_time || validationErrors.arrival_time[0]}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Input 
                id="base_fare" 
                name="base_fare"
                label="Fare ($)" 
                type="number"
                step="0.01"
                required 
                value={formData.base_fare} 
                onChange={handleInputChange} 
              />
              {(localErrors.base_fare || validationErrors?.base_fare) && (
                <p className="text-xs text-rose-600 mt-1 pl-1">
                  {localErrors.base_fare || validationErrors.base_fare[0]}
                </p>
              )}
            </div>

            <div>
              <Input 
                id="total_seats" 
                name="total_seats"
                label="Total Seats" 
                type="number"
                required 
                value={formData.total_seats} 
                onChange={handleInputChange} 
              />
              {(localErrors.total_seats || validationErrors?.total_seats) && (
                <p className="text-xs text-rose-600 mt-1 pl-1">
                  {localErrors.total_seats || validationErrors.total_seats[0]}
                </p>
              )}
            </div>

            <div>
              <Input 
                id="available_seats" 
                name="available_seats"
                label="Available" 
                type="number"
                required 
                value={formData.available_seats} 
                onChange={handleInputChange} 
              />
              {(localErrors.available_seats || validationErrors?.available_seats) && (
                <p className="text-xs text-rose-600 mt-1 pl-1">
                  {localErrors.available_seats || validationErrors.available_seats[0]}
                </p>
              )}
            </div>
          </div>

          <div>
            <Select 
              id="status" 
              name="status"
              label="Flight Status" 
              options={statusOptions} 
              value={formData.status} 
              onChange={handleInputChange} 
            />
          </div>

          <button 
            disabled={actionLoading} 
            className="w-full bg-on-surface text-primary-container font-bold py-3.5 rounded-xl mt-4 hover:bg-[#333] transition-colors duration-300 active:scale-95 flex items-center justify-center gap-2 shadow-md cursor-pointer"
            type="submit"
          >
            {actionLoading ? 'Saving...' : 'Save Flight Route'}
          </button>
        </form>
      </Modal>
    </div>
  );
}
