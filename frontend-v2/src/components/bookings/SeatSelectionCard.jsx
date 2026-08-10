import React, { useState, useEffect, useMemo } from 'react';
import { flightsAPI } from '@/services/flight-service/flightService';
import toast from 'react-hot-toast';

export default function SeatSelectionCard({
  flight,
  cabinClass,
  passengers,
  selectedSeats,
  onSeatSelect,
}) {
  const [seats, setSeats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSeats() {
      try {
        setLoading(true);
        const res = await flightsAPI.getSeats(flight.id);
        const rawSeats = Array.isArray(res) ? res : (res.results || []);
        const cabinSeats = rawSeats.filter(s => s.seat_class === cabinClass);
        setSeats(cabinSeats);
      } catch (err) {
        toast.error("Failed to load seats.");
      } finally {
        setLoading(false);
      }
    }
    if (flight?.id) {
      loadSeats();
    }
  }, [flight?.id, cabinClass]);

  const layoutCols = useMemo(() => {
    let layoutStr = "3-3";
    if (cabinClass === 'ECONOMY') layoutStr = flight.aircraft_economy_layout || flight.aircraft?.economy_layout || "3-3";
    else if (cabinClass === 'BUSINESS') layoutStr = flight.aircraft_business_layout || flight.aircraft?.business_layout || "2-2";
    else if (cabinClass === 'FIRST') layoutStr = flight.aircraft_first_class_layout || flight.aircraft?.first_class_layout || "2-2";
    
    return layoutStr.split('-').map(Number);
  }, [flight, cabinClass]);

  const rowMap = useMemo(() => {
    const map = new Map();
    seats.forEach(seat => {
      const rowId = seat.seat_number.slice(0, -1);
      if (!map.has(rowId)) map.set(rowId, []);
      map.get(rowId).push(seat);
    });
    const sortedRowIds = Array.from(map.keys()).sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, ''), 10) || 0;
      const numB = parseInt(b.replace(/\D/g, ''), 10) || 0;
      return numA - numB;
    });
    return sortedRowIds.map(rowId => ({
      rowId,
      seats: map.get(rowId).sort((a, b) => a.seat_number.localeCompare(b.seat_number)),
    }));
  }, [seats]);

  const maxSeats = passengers.length;

  const toggleSeat = (seat) => {
    if (seat.status !== 'AVAILABLE') return;
    
    const isSelected = selectedSeats.some(s => s.id === seat.id);
    if (isSelected) {
      onSeatSelect(selectedSeats.filter(s => s.id !== seat.id));
    } else {
      if (selectedSeats.length >= maxSeats) {
        toast.error(`You can only select up to ${maxSeats} seat(s).`);
        return;
      }
      onSeatSelect([...selectedSeats, seat]);
    }
  };

  const getSeatColor = (seat) => {
    const isSelected = selectedSeats.some(s => s.id === seat.id);
    if (isSelected) return 'bg-yellow-400 text-yellow-950 border-yellow-500 shadow-sm';
    if (seat.status !== 'AVAILABLE') return 'bg-slate-200 text-slate-400 border-slate-200 cursor-not-allowed';
    if (Number(seat.seat_fee) > 0) return 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 hover:border-blue-300 cursor-pointer';
    return 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300 cursor-pointer';
  };

  if (loading) {
    return (
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm animate-pulse space-y-4">
        <div className="h-6 w-1/3 bg-slate-200 rounded"></div>
        <div className="h-64 bg-slate-100 rounded-xl"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-100 shadow-sm">
      <div className="mb-6 flex justify-between items-end">
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-1">Select Your Seats</h2>
          <p className="text-sm text-slate-500">
            {selectedSeats.length} of {maxSeats} seat(s) selected
          </p>
        </div>
      </div>

      <div className="flex flex-col xl:flex-row gap-6 xl:gap-8">
        <div className="flex-1 bg-slate-50 p-4 sm:p-6 rounded-2xl border border-slate-200 flex justify-center">
          <div className="flex flex-col items-center gap-4 w-full max-w-sm sm:max-w-md md:max-w-lg">
            <div className="w-full text-center pb-4 border-b-2 border-slate-200 border-dashed mb-2">
              <span className="material-symbols-outlined text-slate-300 text-3xl">flight</span>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Front</p>
            </div>

            {rowMap.map((row) => {
              let seatIdx = 0;
              return (
                <div key={row.rowId} className="flex gap-2 sm:gap-3 md:gap-5 items-center justify-center w-full">
                  {layoutCols.map((colSize, groupIdx) => {
                    const blockSeats = row.seats.slice(seatIdx, seatIdx + colSize);
                    seatIdx += colSize;
                    
                    return (
                      <React.Fragment key={`${row.rowId}-group-${groupIdx}`}>
                        <div className="flex gap-1 sm:gap-1.5 md:gap-2">
                          {blockSeats.map(seat => (
                            <button
                              key={seat.id}
                              type="button"
                              onClick={() => toggleSeat(seat)}
                              disabled={seat.status !== 'AVAILABLE'}
                              className={`w-8 h-8 sm:w-10 sm:h-10 md:w-11 md:h-11 rounded-t-xl rounded-b-md border transition-all duration-200 flex flex-col items-center justify-center group relative ${getSeatColor(seat)}`}
                            >
                              <span className="text-[10px] sm:text-xs font-bold leading-none">{seat.seat_number.slice(-1)}</span>
                              {Number(seat.seat_fee) > 0 && seat.status === 'AVAILABLE' && (
                                <span className="absolute -top-1 -right-1 w-2 h-2 md:w-2.5 md:h-2.5 rounded-full bg-blue-500 shadow-sm border-2 border-white"></span>
                              )}
                            </button>
                          ))}
                          {Array.from({ length: colSize - blockSeats.length }).map((_, i) => (
                            <div key={`empty-${i}`} className="w-8 h-8 sm:w-10 sm:h-10 md:w-11 md:h-11"></div>
                          ))}
                        </div>
                        {groupIdx < layoutCols.length - 1 && (
                          <div className="w-4 sm:w-5 md:w-8 flex items-center justify-center">
                            <span className="text-[10px] text-slate-400 font-semibold">{row.rowId.replace(/\D/g, '')}</span>
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        <div className="w-full xl:w-64 flex-shrink-0 space-y-6">
          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
            <h3 className="text-sm font-bold text-slate-900 mb-4">Legend</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded border border-slate-200 bg-white"></div>
                <span className="text-xs text-slate-600 font-medium">Available</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded border border-blue-200 bg-blue-50 relative">
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-blue-500 border-2 border-white"></span>
                </div>
                <span className="text-xs text-slate-600 font-medium">Premium (Fee applies)</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded border border-yellow-500 bg-yellow-400 shadow-sm shadow-yellow-200"></div>
                <span className="text-xs text-slate-600 font-medium">Selected</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded border border-slate-200 bg-slate-200"></div>
                <span className="text-xs text-slate-400 font-medium">Unavailable</span>
              </div>
            </div>
          </div>

          {selectedSeats.length > 0 && (
            <div className="bg-white p-5 rounded-2xl border border-yellow-200 shadow-sm shadow-yellow-100/50">
              <h3 className="text-sm font-bold text-slate-900 mb-3 flex justify-between">
                <span>Selected Seats</span>
                <span className="text-yellow-600">{selectedSeats.length}/{maxSeats}</span>
              </h3>
              <div className="space-y-2">
                {selectedSeats.map(seat => (
                  <div key={seat.id} className="flex justify-between items-center text-sm">
                    <span className="font-bold text-slate-800">{seat.seat_number}</span>
                    <span className="text-slate-500 font-medium text-xs">
                      {Number(seat.seat_fee) > 0 ? `+₹${seat.seat_fee}` : 'Included'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
