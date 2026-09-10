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
  SIN: { city: "Singapore", code: "SIN", name: "Changi Airport", country: "Singapore" },
  CNN: { city: "Kannur", code: "CNN", name: "Kannur International Airport", country: "India" },
  CCJ: { city: "Kozhikode", code: "CCJ", name: "Calicut International Airport", country: "India" },
  BKK: { city: "Bangkok", code: "BKK", name: "Suvarnabhumi Airport", country: "Thailand" },
  CDG: { city: "Paris", code: "CDG", name: "Charles de Gaulle Airport", country: "France" },
  SYD: { city: "Sydney", code: "SYD", name: "Sydney Kingsford Smith Airport", country: "Australia" },
  SUM: { city: "SumeshNagar", code: "SUM", name: "sumesh international airport", country: "India" }
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

/**
 * Dynamically register airports from backend or external sources
 */
export function registerAirports(airportsList) {
  if (!Array.isArray(airportsList)) return;
  airportsList.forEach((item) => {
    const code = item.code || item.iata_code;
    if (code) {
      const codeUpper = String(code).trim().toUpperCase();
      const entry = {
        city: item.city || codeUpper,
        code: codeUpper,
        name: item.name || item.airport_name || `${codeUpper} Airport`,
        country: item.country || item.country_name || ""
      };
      AIRPORT_MAP[codeUpper] = entry;
      JSON_AIRPORT_MAP[codeUpper] = entry;
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
      (item) => (item.city && item.city.toUpperCase() === upper) || (item.name && item.name.toUpperCase().includes(upper))
    ) ||
    Object.values(JSON_AIRPORT_MAP).find(
      (item) => (item.city && item.city.toUpperCase() === upper) || (item.name && item.name.toUpperCase().includes(upper))
    );

  if (found) return found;

  return { city: upper, code: upper, name: `${upper} Airport`, country: "" };
}

/**
 * Resolve a user-entered search term to an airport object
 * @param {string} query - The user typed text (e.g. "Kannur", "kannu", "CNN", "delhi")
 * @param {Array} airports - List of loaded airports
 * @returns {object|null} - Matched airport or null
 */
export function resolveAirport(query, airports = []) {
  if (!query) return null;
  const qTrim = String(query).trim();
  if (!qTrim) return null;
  const qUpper = qTrim.toUpperCase();
  const qLower = qTrim.toLowerCase();

  // 1. Direct code match in AIRPORT_MAP
  if (AIRPORT_MAP[qUpper]) return AIRPORT_MAP[qUpper];

  // 2. Direct code match in airports list
  const codeMatch = airports.find(
    (a) => (a.code || a.iata_code || "").toUpperCase() === qUpper
  );
  if (codeMatch) {
    return {
      code: codeMatch.code || codeMatch.iata_code,
      city: codeMatch.city || codeMatch.code,
      name: codeMatch.name || codeMatch.airport_name || "",
      country: codeMatch.country || codeMatch.country_name || ""
    };
  }

  // 3. Exact city match
  const cityMatch =
    airports.find((a) => (a.city || "").toUpperCase() === qUpper) ||
    Object.values(AIRPORT_MAP).find((a) => (a.city || "").toUpperCase() === qUpper);
  if (cityMatch) return cityMatch;

  // 4. Exact name match
  const nameMatch =
    airports.find((a) => (a.name || a.airport_name || "").toUpperCase() === qUpper) ||
    Object.values(AIRPORT_MAP).find((a) => (a.name || "").toUpperCase() === qUpper);
  if (nameMatch) return nameMatch;

  // 5. Starts with city or code
  const startsMatch = airports.find((a) => {
    const code = (a.code || a.iata_code || "").toLowerCase();
    const city = (a.city || "").toLowerCase();
    return city.startsWith(qLower) || code.startsWith(qLower);
  });
  if (startsMatch) {
    return {
      code: startsMatch.code || startsMatch.iata_code,
      city: startsMatch.city || startsMatch.code,
      name: startsMatch.name || startsMatch.airport_name || "",
      country: startsMatch.country || startsMatch.country_name || ""
    };
  }

  // 6. Substring match
  const subMatch = airports.find((a) => {
    const code = (a.code || a.iata_code || "").toLowerCase();
    const city = (a.city || "").toLowerCase();
    const name = (a.name || a.airport_name || "").toLowerCase();
    return code.includes(qLower) || city.includes(qLower) || name.includes(qLower);
  });
  if (subMatch) {
    return {
      code: subMatch.code || subMatch.iata_code,
      city: subMatch.city || subMatch.code,
      name: subMatch.name || subMatch.airport_name || "",
      country: subMatch.country || subMatch.country_name || ""
    };
  }

  // 7. 3-letter IATA code format fallback
  if (/^[A-Z]{3}$/.test(qUpper)) {
    return {
      code: qUpper,
      city: qUpper,
      name: `${qUpper} Airport`,
      country: ""
    };
  }

  return null;
}

