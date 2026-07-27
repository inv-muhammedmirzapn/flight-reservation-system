import { useState } from "react";
import FlightSearchHeader from "@/components/flights/FlightSearchHeader";

export default function FlightsPage() {
  const [searchCriteria, setSearchCriteria] = useState({});

  const handleSearchChange = (newCriteria) => {
    setSearchCriteria(newCriteria);
  };

  return (
    <div className="flex-1 min-h-screen bg-slate-50/60 mt-6 pt-16 pb-12 px-4 md:px-6 max-w-6xl mx-auto w-full">
      {/* Top Search Header Component */}
      <div className="mb-6">
        <FlightSearchHeader onSearchChange={handleSearchChange} />
      </div>

      {/* Container for Next Components */}
      <div className="bg-white/60 backdrop-blur-md rounded-xl border border-slate-200/60 p-6 text-center text-slate-500 font-semibold text-xs">
        Flight search header ready. Next components will be added here step by step.
      </div>
    </div>
  );
}
