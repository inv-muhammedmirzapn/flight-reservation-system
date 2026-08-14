import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { flightsAPI } from '@/services/flight-service/flightService';
import { bookingAPI } from '@/services/booking-service/bookingService';
import SeatHoldTimer from './SeatHoldTimer';
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
  const [holdingSeatNumber, setHoldingSeatNumber] = useState(null);

  const loadSeats = useCallback(async (isMounted = true) => {
    try {
      setLoading(true);
      const res = await flightsAPI.getSeats(flight?.id);
      if (!isMounted) return;

      const rawSeats = Array.isArray(res) ? res : (res.results || []);
      const cabinSeats = rawSeats.filter(s => s.seat_class === cabinClass);
      setSeats(cabinSeats);
    } catch (err) {
      if (isMounted) toast.error("Failed to load seats.");
    } finally {
      if (isMounted) setLoading(false);
    }
  }, [flight?.id, cabinClass]);

  useEffect(() => {
    let isMounted = true;
    if (flight?.id) {
      loadSeats(isMounted);
    }
    return () => {
      isMounted = false;
    };
  }, [flight?.id, cabinClass, loadSeats]);

  const layoutCols = useMemo(() => {
    let layoutStr = "3-3";
    if (cabinClass === 'ECONOMY') layoutStr = flight?.aircraft_economy_layout || flight?.aircraft?.economy_layout || "3-3";
    else if (cabinClass === 'BUSINESS') layoutStr = flight?.aircraft_business_layout || flight?.aircraft?.business_layout || "2-2";
    else if (cabinClass === 'FIRST') layoutStr = flight?.aircraft_first_class_layout || flight?.aircraft?.first_class_layout || "2-2";
    
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

  // Find earliest hold expiration time among selected seats
  const activeHoldExpiresAt = useMemo(() => {
    const holds = selectedSeats.filter(s => s.expiresAt);
    if (holds.length === 0) return null;
    return Math.min(...holds.map(s => s.expiresAt));
  }, [selectedSeats]);

  const handleTimerExpire = useCallback(() => {
    toast.error("Your seat hold has expired. Please select your seats again.");
    onSeatSelect([]);
    loadSeats();
  }, [onSeatSelect, loadSeats]);

  const toggleSeat = async (seat) => {
    const isSelected = selectedSeats.some(s => s.id === seat.id || s.seat_number === seat.seat_number);

    if (isSelected) {
      // Release hold when deselecting seat
      const targetSeat = selectedSeats.find(s => s.id === seat.id || s.seat_number === seat.seat_number);
      if (targetSeat?.holdId) {
        try {
          setHoldingSeatNumber(seat.seat_number);
          await bookingAPI.releaseHold(targetSeat.holdId);
        } catch (err) {
          console.warn("Could not release seat hold:", err);
        } finally {
          setHoldingSeatNumber(null);
        }
      }
      onSeatSelect(selectedSeats.filter(s => s.id !== seat.id && s.seat_number !== seat.seat_number));
    } else {
      if (maxSeats <= 0) return;
      setHoldingSeatNumber(seat.seat_number);

      try {
        let oldSeatToReplace = null;
        let remainingSeats = [...selectedSeats];

        if (selectedSeats.length >= maxSeats) {
          // FIFO seat replacement: pass old_seat_number to replace hold atomically
          oldSeatToReplace = selectedSeats[0];
          remainingSeats = selectedSeats.slice(1);
        }

        const holdRes = await bookingAPI.holdSeat(
          flight.id,
          seat.seat_number,
          oldSeatToReplace ? oldSeatToReplace.seat_number : null
        );

        const secondsRemaining = holdRes.seconds_remaining || 600;
        const expiresAt = Date.now() + secondsRemaining * 1000;

        const updatedSeatObj = {
          ...seat,
          holdId: holdRes.id,
          expiresAt,
        };

        onSeatSelect([...remainingSeats, updatedSeatObj]);
      } catch (err) {
        const errMsg = err?.detail || err?.message || "Failed to hold seat.";
        toast.error(errMsg);
        loadSeats();
      } finally {
        setHoldingSeatNumber(null);
      }
    }
  };

  const uniqueFees = useMemo(() => {
    const fees = new Set();
    seats.forEach(s => fees.add(Number(s.seat_fee || 0)));
    return Array.from(fees).sort((a, b) => a - b);
  }, [seats]);

  const FEE_COLORS = [
    'bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300',
    'bg-sky-50 border-sky-200 hover:bg-sky-100 hover:border-sky-300',
    'bg-blue-100 border-blue-300 hover:bg-blue-200 hover:border-blue-400',
    'bg-indigo-100 border-indigo-300 hover:bg-indigo-200 hover:border-indigo-400',
    'bg-purple-100 border-purple-300 hover:bg-purple-200 hover:border-purple-400'
  ];

  const getSeatColor = (seat) => {
    const isSelected = selectedSeats.some(s => s.id === seat.id || s.seat_number === seat.seat_number);
    if (isSelected) return 'bg-yellow-400 text-yellow-950 border-yellow-500 shadow-sm';
    
    if (seat.status === 'HELD') {
      return 'bg-amber-100/70 text-amber-700/60 border-amber-200 cursor-not-allowed';
    }
    if (seat.status !== 'AVAILABLE') {
      return 'bg-slate-200 text-slate-400 border-slate-200 cursor-not-allowed';
    }
    
    const feeIndex = uniqueFees.indexOf(Number(seat.seat_fee || 0));
    const colorClass = FEE_COLORS[Math.min(feeIndex, FEE_COLORS.length - 1)] || FEE_COLORS[0];
    return `${colorClass} cursor-pointer`;
  };

  const formatPosition = (seat) => {
    if (seat.extra_legroom) return "Extra Legroom";
    if (seat.exit_row) return "Exit Row";
    const pos = seat.position || "Middle";
    return pos.charAt(0).toUpperCase() + pos.slice(1).toLowerCase() + " Seat";
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
      {/* Seat Hold Countdown Banner */}
      {activeHoldExpiresAt && (
        <SeatHoldTimer expiresAt={activeHoldExpiresAt} onExpire={handleTimerExpire} />
      )}

      <div className="mb-6 flex justify-between items-end">
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-1">Select Your Seats</h2>
          <p className="text-sm text-slate-500">
            {selectedSeats.length} of {maxSeats} seat(s) selected
          </p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start">
        <div className="flex-1 w-full bg-slate-50 p-4 sm:p-6 rounded-2xl border border-slate-200 flex justify-center overflow-x-auto">
          <div className="flex flex-col items-center gap-4 w-full max-w-sm sm:max-w-md md:max-w-lg">
            <div className="w-full text-center pb-4 border-b-2 border-slate-200 border-dashed mb-2">
              <span className="material-symbols-outlined text-slate-300 text-3xl">flight</span>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Front</p>
            </div>

            {rowMap.length > 0 && (
              <div className="flex gap-1 sm:gap-1.5 md:gap-2 items-center justify-center w-full mb-1">
                <div className="w-4 sm:w-5 flex-shrink-0"></div> {/* Left spacer */}
                {(() => {
                  let seatIdx = 0;
                  return layoutCols.map((colSize, groupIdx) => {
                    const blockSeats = rowMap[0].seats.slice(seatIdx, seatIdx + colSize);
                    seatIdx += colSize;
                    return (
                      <React.Fragment key={`header-group-${groupIdx}`}>
                        <div className="flex gap-1 sm:gap-1.5 md:gap-2">
                          {blockSeats.map(seat => (
                            <div key={seat.id} className="w-7 sm:w-8 md:w-9 text-center">
                              <span className="text-[11px] sm:text-xs font-bold text-slate-500">
                                {seat.seat_number.slice(-1)}
                              </span>
                            </div>
                          ))}
                          {Array.from({ length: colSize - blockSeats.length }).map((_, i) => (
                            <div key={`header-empty-${i}`} className="w-7 sm:w-8 md:w-9"></div>
                          ))}
                        </div>
                        {groupIdx < layoutCols.length - 1 && (
                          <div className="w-6 sm:w-8 md:w-10 flex-shrink-0"></div>
                        )}
                      </React.Fragment>
                    );
                  });
                })()}
                <div className="w-4 sm:w-5 flex-shrink-0"></div> {/* Right spacer */}
              </div>
            )}

            {rowMap.map((row) => {
              let seatIdx = 0;
              return (
                <div key={row.rowId} className="flex gap-1 sm:gap-1.5 md:gap-2 items-center justify-center w-full mb-1">
                  {/* Left Row Number */}
                  <div className="w-4 sm:w-5 flex-shrink-0 flex items-center justify-end pr-1">
                    <span className="text-[10px] sm:text-xs text-slate-500 font-bold">{row.rowId.replace(/\D/g, '')}</span>
                  </div>

                  {layoutCols.map((colSize, groupIdx) => {
                    const blockSeats = row.seats.slice(seatIdx, seatIdx + colSize);
                    seatIdx += colSize;
                    
                    return (
                      <React.Fragment key={`${row.rowId}-group-${groupIdx}`}>
                        <div className="flex gap-1 sm:gap-1.5 md:gap-2">
                          {blockSeats.map(seat => {
                            const isSelected = selectedSeats.some(s => s.id === seat.id || s.seat_number === seat.seat_number);
                            const isAvailable = seat.status === 'AVAILABLE' || isSelected;
                            const isCurrentlyHolding = holdingSeatNumber === seat.seat_number;

                            return (
                              <button
                                key={seat.id}
                                type="button"
                                onClick={() => toggleSeat(seat)}
                                disabled={!isAvailable || isCurrentlyHolding}
                                className={`w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 rounded-md border transition-all duration-200 flex flex-col items-center justify-center group relative hover:z-50 ${getSeatColor(seat)} ${
                                  isCurrentlyHolding ? 'animate-pulse opacity-75' : ''
                                }`}
                              >
                                  {/* Hover Tooltip */}
                                  <div className="absolute bottom-full mb-1 sm:mb-1.5 hidden group-hover:flex flex-col items-center justify-center w-max bg-slate-800 text-white text-[10px] sm:text-[11px] rounded py-1.5 px-2.5 pointer-events-none shadow-md font-medium">
                                    {seat.status === 'HELD' && !isSelected ? (
                                      <span>Temporarily held by another passenger</span>
                                    ) : seat.status !== 'AVAILABLE' && !isSelected ? (
                                      <span>Seat already booked</span>
                                    ) : (
                                      <>
                                        <span>{seat.seat_number} ({formatPosition(seat)})</span>
                                        <span className={Number(seat.seat_fee) > 0 ? "text-amber-300" : "text-emerald-300"}>
                                          {Number(seat.seat_fee) > 0 ? '+₹' + Number(seat.seat_fee).toLocaleString('en-IN') : 'Included'}
                                        </span>
                                      </>
                                    )}
                                    {/* Tooltip Caret */}
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-[4px] border-transparent border-t-slate-800"></div>
                                  </div>
                                
                                {!isAvailable && !isSelected && (
                                  <span className="material-symbols-outlined text-slate-300 text-base sm:text-lg absolute inset-0 m-auto flex items-center justify-center select-none pointer-events-none opacity-50">
                                    {seat.status === 'HELD' ? 'lock' : 'close'}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                          {Array.from({ length: colSize - blockSeats.length }).map((_, i) => (
                            <div key={`empty-${i}`} className="w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9"></div>
                          ))}
                        </div>
                        {groupIdx < layoutCols.length - 1 && (
                          <div className="w-6 sm:w-8 md:w-10 flex-shrink-0"></div>
                        )}
                      </React.Fragment>
                    );
                  })}

                  {/* Right Row Number */}
                  <div className="w-4 sm:w-5 flex-shrink-0 flex items-center justify-start pl-1">
                    <span className="text-[10px] sm:text-xs text-slate-500 font-bold">{row.rowId.replace(/\D/g, '')}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="w-full lg:w-56 xl:w-64 flex-shrink-0 space-y-6 lg:sticky lg:top-24">
          <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200">
            <div className="space-y-3">
              {uniqueFees.map((fee, idx) => {
                 const colorClass = FEE_COLORS[Math.min(idx, FEE_COLORS.length - 1)];
                 const legendBoxClass = colorClass.split(' hover:')[0];
                 return (
                   <div key={fee} className="flex items-center gap-3">
                     <div className={`w-6 h-6 rounded border ${legendBoxClass}`}></div>
                     <span className="text-xs text-slate-600 font-medium">
                       {fee === 0 ? 'Standard Seat' : `₹${fee.toLocaleString('en-IN')}`}
                     </span>
                   </div>
                 );
              })}
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded border border-yellow-500 bg-yellow-400 shadow-sm shadow-yellow-200"></div>
                <span className="text-xs text-slate-600 font-medium">Selected</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded border border-amber-200 bg-amber-100/70"></div>
                <span className="text-xs text-slate-500 font-medium">Held by other</span>
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
                  <div key={seat.id || seat.seat_number} className="flex justify-between items-center text-sm">
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
