import airportsData from "../../resources/airports.json";

export const AIRPORT_MAP = {
  DEL: { city: "New Delhi", code: "DEL", name: "Indira Gandhi International Airport", country: "India" },
  HAM: { city: "Hamburg", code: "HAM", name: "Fuhlsbuettel Airport", country: "Germany" },
  COK: { city: "Cochin", code: "COK", name: "Cochin International Airport", country: "India" },
  AUH: { city: "Abu Dhabi", code: "AUH", name: "Abu Dhabi International Airport", country: "UAE" },
  DXB: { city: "Dubai", code: "DXB", name: "Dubai International Airport", country: "UAE" },
  TRV: { city: "Trivandrum", code: "TRV", name: "Trivandrum International Airport", country: "India" },
  BOM: { city: "Mumbai", code: "BOM", name: "Chhatrapati Shivaji Maharaj International Airport", country: "India" },
  BLR: { city: "Bengaluru", code: "BLR", name: "Kempegowda International Airport", country: "India" },
  FRA: { city: "Frankfurt", code: "FRA", name: "Frankfurt Airport", country: "Germany" },
  MUC: { city: "Munich", code: "MUC", name: "Munich Airport", country: "Germany" },
  DOH: { city: "Doha", code: "DOH", name: "Hamad International Airport", country: "Qatar" },
  IST: { city: "Istanbul", code: "IST", name: "Istanbul Airport", country: "Turkey" },
  JFK: { city: "New York", code: "JFK", name: "John F. Kennedy International Airport", country: "USA" },
  LHR: { city: "London", code: "LHR", name: "Heathrow Airport", country: "UK" },
  HND: { city: "Tokyo", code: "HND", name: "Haneda Airport", country: "Japan" },
  SIN: { city: "Singapore", code: "SIN", name: "Changi Airport", country: "Singapore" }
};

const JSON_AIRPORT_MAP = {};
if (Array.isArray(airportsData)) {
  airportsData.forEach((item) => {
    if (item && item.code) {
      const codeUpper = String(item.code).trim().toUpperCase();
      JSON_AIRPORT_MAP[codeUpper] = {
        city: item.city || codeUpper,
        code: codeUpper,
        name: item.name || `${codeUpper} Airport`,
        country: item.country || ""
      };
    }
  });
}

export function getAirportInfo(input) {
  if (!input) return { city: "Unknown", code: "---", name: "Airport", country: "" };
  const upper = String(input).trim().toUpperCase();
  if (AIRPORT_MAP[upper]) return AIRPORT_MAP[upper];
  if (JSON_AIRPORT_MAP[upper]) return JSON_AIRPORT_MAP[upper];

  // Search by city name or airport name match
  const found =
    Object.values(AIRPORT_MAP).find(
      (item) => item.city.toUpperCase() === upper || item.name.toUpperCase().includes(upper)
    ) ||
    Object.values(JSON_AIRPORT_MAP).find(
      (item) => item.city.toUpperCase() === upper || item.name.toUpperCase().includes(upper)
    );

  if (found) return found;

  return { city: upper, code: upper, name: `${upper} Airport`, country: "" };
}

