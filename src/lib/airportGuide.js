const cleanCode = value => String(value || "").trim().toUpperCase();

export function buildAirportStops(legs = []) {
  const airLegs = legs.filter(leg => leg?.transportation_type === "air");
  if (!airLegs.length) return [];

  const stops = [];
  const add = (code, role) => {
    const airportCode = cleanCode(code);
    if (!airportCode) return;
    const existing = stops.find(stop => stop.code === airportCode);
    if (existing) {
      if (!existing.roles.includes(role)) existing.roles.push(role);
      return;
    }
    stops.push({ code: airportCode, role, roles: [role] });
  };

  airLegs.forEach((leg, index) => {
    add(leg.origin_airport_code, index === 0 ? "departure" : "layover");
    add(leg.destination_airport_code, index === airLegs.length - 1 ? "arrival" : "layover");
  });
  return stops;
}

export const AIRPORT_ROLE_LABELS = {
  departure: "Departure airport",
  layover: "Layover airport",
  arrival: "Arrival airport",
};

export const AIRPORT_ROLE_SECTIONS = {
  departure: ["petReliefAreas", "petCheckIn", "cargoLocations", "securityScreening", "veterinaryInspection", "serviceAnimalProcess", "operatingHours", "emergencyVet"],
  layover: ["petReliefAreas", "securityScreening", "customsProcess", "veterinaryInspection", "serviceAnimalProcess", "operatingHours", "emergencyVet"],
  arrival: ["customsProcess", "veterinaryInspection", "cargoLocations", "petReliefAreas", "serviceAnimalProcess", "operatingHours", "emergencyVet"],
};
