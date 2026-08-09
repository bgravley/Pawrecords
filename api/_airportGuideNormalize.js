const text = value => typeof value === "string" ? value.trim() : "";
const list = value => Array.isArray(value) ? value : [];

export function normalizeAirportGuide(value, airportCode, verifiedAt = new Date().toISOString()) {
  const guide = value && typeof value === "object" ? value : {};
  return {
    airportCode,
    airportName: text(guide.airportName) || airportCode,
    summary: text(guide.summary),
    petReliefAreas: list(guide.petReliefAreas).map(area => ({
      location: text(area?.location), terminal: text(area?.terminal) || null,
      type: ["indoor", "outdoor"].includes(area?.type) ? area.type : null,
      notes: text(area?.notes),
    })).filter(area => area.location),
    petCheckIn: text(guide.petCheckIn), cargoLocations: text(guide.cargoLocations),
    securityScreening: text(guide.securityScreening), customsProcess: text(guide.customsProcess),
    veterinaryInspection: text(guide.veterinaryInspection), serviceAnimalProcess: text(guide.serviceAnimalProcess),
    operatingHours: text(guide.operatingHours), emergencyVet: text(guide.emergencyVet),
    officialSources: list(guide.officialSources).map(source => ({
      authority: text(source?.authority), sourceType: source?.sourceType === "government" ? "government" : "airport",
      url: text(source?.url), supports: text(source?.supports),
    })).filter(source => /^https?:\/\//i.test(source.url) && source.authority),
    lastVerified: verifiedAt,
  };
}
