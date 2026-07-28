export const AIRPORT_MAP = {
  DEL: { city: "New Delhi", code: "DEL", name: "Indira Gandhi International Airport", country: "India" },
  HAM: { city: "Hamburg", code: "HAM", name: "Fuhlsbuettel Airport", country: "Germany" },
  COK: { city: "Cochin", code: "COK", name: "Cochin International Airport", country: "India" },
  AUH: { city: "Abu Dhabi", code: "AUH", name: "Abu Dhabi International Airport", country: "UAE" },
  DXB: { city: "Dubai", code: "DXB", name: "Dubai International Airport", country: "UAE" },
  TRV: { city: "Trivandrum", code: "TRV", name: "Trivandrum International Airport", country: "India" },
  BOM: { city: "Mumbai", code: "BOM", name: "Chhatrapati Shivaji Maharaj International Airport", country: "India" },
  BLR: { city: "Bengaluru", code: "BLR", name: "Kempegowda International Airport", country: "India" },
  JFK: { city: "New York", code: "JFK", name: "John F. Kennedy International Airport", country: "USA" },
  LHR: { city: "London", code: "LHR", name: "Heathrow Airport", country: "UK" },
  HND: { city: "Tokyo", code: "HND", name: "Haneda Airport", country: "Japan font" },
  SIN: { city: "Singapore", code: "SIN", name: "Changi Airport", country: "Singapore" }
};

export function getAirportInfo(code) {
  if (!code) return { city: "Unknown", code: "---", name: "Airport", country: "" };
  const upper = String(code).trim().toUpperCase();
  return AIRPORT_MAP[upper] || { city: upper, code: upper, name: `${upper} Airport`, country: "" };
}
