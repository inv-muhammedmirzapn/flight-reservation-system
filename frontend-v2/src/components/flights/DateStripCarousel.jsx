import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";

export default function DateStripCarousel({ selectedDepDate, onSelectDate }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const scrollRef = useRef(null);
  const selectedItemRef = useRef(null);

  const todayStr = new Date().toISOString().split("T")[0];
  const activeDate = selectedDepDate || searchParams.get("depDate") || todayStr;

  const [dates, setDates] = useState([]);

  useEffect(() => {
    const list = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 60; i++) {
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
  }, []);

  // Smooth centering behavior whenever activeDate changes
  useEffect(() => {
    if (selectedItemRef.current && scrollRef.current) {
      selectedItemRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center"
      });
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
        className="flex-1 h-9 px-2 overflow-x-auto scroll-smooth no-scrollbar flex items-stretch divide-x divide-slate-300/60 rounded-xl"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {dates.map((item) => {
          const isSelected = item.isoStr === activeDate;
          return (
            <button
              key={item.isoStr}
              ref={isSelected ? selectedItemRef : null}
              type="button"
              onClick={() => handleDateClick(item.isoStr)}
              className={`flex-1 min-w-[115px] sm:min-w-[130px] py-2 px-3 flex flex-col items-center justify-center transition-all cursor-pointer select-none ${
                isSelected
                  ? "bg-[#ffeb00] text-slate-950 font-black shadow-inner z-10"
                  : "hover:bg-slate-200/70 text-slate-800"
              }`}
            >
              <span
                className={`text-[10px] ${
                  isSelected ? "text-slate-950 font-bold" : "text-slate-700"
                }`}
              >
                {item.dateStr}
              </span>
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
