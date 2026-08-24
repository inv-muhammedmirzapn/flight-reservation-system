import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { flightsAPI } from "@/services/flight-service/flightService";

export default function DateStripCarousel({ selectedDepDate, onSelectDate, filters }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const scrollRef = useRef(null);
  const selectedItemRef = useRef(null);

  const from = searchParams.get("from") || "DEL";
  const to = searchParams.get("to") || "HAM";
  const todayStr = new Date().toISOString().split("T")[0];
  const activeDate = selectedDepDate || searchParams.get("depDate") || todayStr;

  const [dates, setDates] = useState([]);
  const [priceMap, setPriceMap] = useState({});

  const cabinClass = searchParams.get("cabinClass") || "Economy";

  const filtersJson = JSON.stringify(filters || null);

  // Fetch calendar prices for current route and applied filters
  useEffect(() => {
    let isMounted = true;
    const currentFilters = JSON.parse(filtersJson);

    async function loadCalendarPrices() {
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const startStr = today.toISOString().split("T")[0];

        let horizonDays = 90;
        if (activeDate) {
          const activeObj = new Date(activeDate);
          if (!isNaN(activeObj.getTime())) {
            const diffTime = activeObj.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays + 30 > horizonDays) {
              horizonDays = diffDays + 30;
            }
          }
        }

        const endDateObj = new Date(today);
        endDateObj.setDate(today.getDate() + horizonDays);
        const endStr = endDateObj.toISOString().split("T")[0];

        const calendarParams = {
          source: from,
          destination: to,
          start_date: startStr,
          end_date: endStr,
          cabin_class: cabinClass
        };

        if (currentFilters) {
          if (currentFilters.stops !== undefined && currentFilters.stops !== "") calendarParams.stops = currentFilters.stops;
          if (currentFilters.airlines && currentFilters.airlines.length > 0) calendarParams.airlines = currentFilters.airlines.join(",");
          if (currentFilters.waitlistMode && currentFilters.waitlistMode !== "all") calendarParams.waitlist_mode = currentFilters.waitlistMode;
          if (currentFilters.maxFare && currentFilters.maxFare < 100000) calendarParams.max_fare = currentFilters.maxFare;
        }

        const res = await flightsAPI.getCalendar(calendarParams);

        let dataObj = res;
        if (res && typeof res === "object" && res.data !== undefined) {
          dataObj = res.data;
        }

        const map = {};
        if (dataObj && typeof dataObj === "object") {
          if (Array.isArray(dataObj)) {
            dataObj.forEach((item) => {
              if (item.date) {
                map[item.date] = item.min_fare ?? item.price;
              }
            });
          } else {
            Object.entries(dataObj).forEach(([dateStr, price]) => {
              if (typeof price === "object" && price !== null) {
                map[dateStr] = price;
              } else if (price != null && !isNaN(price)) {
                map[dateStr] = Number(price);
              }
            });
          }
        }
        if (isMounted) setPriceMap(map);
      } catch (err) {
        console.warn("Failed to load calendar prices", err);
      }
    }
    if (from && to) {
      loadCalendarPrices();
    }
    return () => { isMounted = false; };
  }, [from, to, cabinClass, filtersJson, activeDate]);

  useEffect(() => {
    const list = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let totalDays = 90;
    if (activeDate) {
      const activeObj = new Date(activeDate);
      if (!isNaN(activeObj.getTime())) {
        const diffTime = activeObj.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays + 30 > totalDays) {
          totalDays = diffDays + 30;
        }
      }
    }

    for (let i = 0; i < totalDays; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const isoStr = `${year}-${month}-${day}`;

      const weekday = d.toLocaleString("en-US", { weekday: "short" });
      const monthShort = d.toLocaleString("en-US", { month: "short" });
      const dayNum = d.getDate();

      list.push({
        isoStr,
        dateStr: `${weekday}, ${dayNum} ${monthShort}`,
        isToday: i === 0
      });
    }
    setDates(list);
  }, [activeDate]);

  // Compute reference price (selected date's price or average of available prices)
  const activeDatePriceRaw = priceMap[activeDate];
  const activeDatePrice = typeof activeDatePriceRaw === "object" ? activeDatePriceRaw?.min_fare : activeDatePriceRaw;
  
  const availablePrices = Object.values(priceMap)
    .map((val) => (typeof val === "object" ? val?.min_fare : val))
    .filter((val) => typeof val === "number" && !isNaN(val) && val > 0);

  const referencePrice = (activeDatePrice != null && !isNaN(activeDatePrice) && Number(activeDatePrice) > 0)
    ? Number(activeDatePrice)
    : (availablePrices.length > 0
        ? availablePrices.reduce((a, b) => a + b, 0) / availablePrices.length
        : null);

  // Smooth centering behavior whenever activeDate changes
  useEffect(() => {
    if (selectedItemRef.current && scrollRef.current) {
      const timer = setTimeout(() => {
        selectedItemRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "center"
        });
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [activeDate, dates]);

  const handleDateClick = (isoStr) => {
    const params = new URLSearchParams(searchParams);
    params.set("depDate", isoStr);
    params.delete("arrDate");
    setSearchParams(params, { replace: true });

    if (onSelectDate) {
      onSelectDate(isoStr);
    }
  };

  const handleScrollLeft = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: -280, behavior: "smooth" });
    }
  };

  const handleScrollRight = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 280, behavior: "smooth" });
    }
  };

  return (
    <div className="w-full mx-auto rounded-2xl shadow-xs flex items-center relative">
      {/* Scroll Left Arrow Button */}
      <button
        type="button"
        onClick={handleScrollLeft}
        className="shrink-0 w-8 h-8 rounded-full bg-white border border-slate-300/80 shadow-xs flex items-center justify-center text-slate-800 hover:bg-slate-100 transition-transform active:scale-95 cursor-pointer z-10 ml-1"
        title="Scroll Left"
      >
        <span className="material-symbols-outlined text-lg select-none font-bold">
          chevron_left
        </span>
      </button>

      {/* Contiguous Date Items Scroll Track */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-[52px] px-2 overflow-x-auto scroll-smooth no-scrollbar flex items-stretch divide-x divide-slate-300/60 rounded-xl"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {dates.map((item) => {
          const isSelected = item.isoStr === activeDate;
          const rawVal = priceMap[item.isoStr];
          const priceVal = typeof rawVal === "object" ? rawVal?.min_fare : rawVal;
          const hasPrice = priceVal != null && !isNaN(priceVal) && Number(priceVal) > 0;
          const numPrice = Number(priceVal);
          
          const itemCurrency = typeof rawVal === "object" ? (rawVal?.currency || "INR") : "INR";
          const formatCurrency = (amount) => {
            return new Intl.NumberFormat('en-IN', {
              style: 'currency',
              currency: itemCurrency,
              minimumFractionDigits: 0,
              maximumFractionDigits: 0
            }).format(amount);
          };

          let priceColorClass;
          if (isSelected) {
            if (referencePrice && numPrice < referencePrice) priceColorClass = "text-emerald-950 font-black";
            else if (referencePrice && numPrice > referencePrice) priceColorClass = "text-rose-950 font-black";
            else priceColorClass = "text-slate-950 font-black";
          } else {
            if (referencePrice && numPrice < referencePrice) priceColorClass = "text-emerald-600 font-extrabold";
            else if (referencePrice && numPrice > referencePrice) priceColorClass = "text-rose-600 font-extrabold";
            else priceColorClass = "text-slate-700 font-bold";
          }

          return (
            <button
              key={item.isoStr}
              ref={isSelected ? selectedItemRef : null}
              type="button"
              onClick={() => handleDateClick(item.isoStr)}
              className={`flex-1 min-w-[115px] sm:min-w-[130px] py-2.5 px-3 flex flex-col items-center justify-center transition-all cursor-pointer select-none ${
                isSelected
                  ? "bg-[#ffeb00] text-slate-950 z-10"
                  : "hover:bg-slate-200/70 text-slate-800"
              }`}
            >
              <span
                className={`text-[10px] mb-1 ${
                  isSelected ? "text-slate-950 font-bold" : "text-slate-700"
                }`}
              >
                {item.dateStr}
              </span>
              {hasPrice ? (
                <span className={`text-[10px] mt-0.5 ${priceColorClass}`}>
                  {formatCurrency(numPrice)}
                </span>
              ) : (
                <span className={`text-[9px] font-medium mt-0.5 ${isSelected ? "text-slate-800" : "text-slate-400"}`}>
                  —
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Scroll Right Arrow Button */}
      <button
        type="button"
        onClick={handleScrollRight}
        className="shrink-0 w-8 h-8 rounded-full bg-white border border-slate-300/80 shadow-xs flex items-center justify-center text-slate-800 hover:bg-slate-100 transition-transform active:scale-95 cursor-pointer z-10 mr-1"
        title="Scroll Right"
      >
        <span className="material-symbols-outlined text-lg select-none font-bold">
          chevron_right
        </span>
      </button>
    </div>
  );
}
