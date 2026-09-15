const text = value => typeof value === "string" ? value.trim() : "";
const list = value => Array.isArray(value) ? value : [];
const url = value => /^https:\/\//i.test(text(value)) ? text(value) : "";

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
    arrivalRecommendation: text(guide.arrivalRecommendation), terminalMapUrl: url(guide.terminalMapUrl),
    waterAvailability: text(guide.waterAvailability), terminalChanges: text(guide.terminalChanges),
    sourceStatus: list(guide.officialSources).some(source => url(source?.url) && source?.sourceType !== "provider") && guide.sourceStatus === "confirmed_official" ? "confirmed_official" : list(guide.officialSources).some(source => url(source?.url)) ? "recheck_needed" : "official_not_found",
    contacts: list(guide.contacts).map(contact => ({
      organization: text(contact?.organization), department: text(contact?.department),
      type: text(contact?.type), phone: text(contact?.phone), email: text(contact?.email),
      website: url(contact?.website), address: text(contact?.address), hours: text(contact?.hours),
      afterHours: text(contact?.afterHours), scope: text(contact?.scope), sourceUrl: url(contact?.sourceUrl),
    })).filter(contact => contact.organization && contact.sourceUrl && (contact.phone || contact.email || contact.website || contact.address)),
    officialFees: list(guide.officialFees).map(fee => ({
      name: text(fee?.name), amount: Number.isFinite(Number(fee?.amount)) && Number(fee.amount) >= 0 ? Number(fee.amount) : null,
      currency: /^[A-Z]{3}$/.test(text(fee?.currency)) ? text(fee.currency) : "",
      basis: text(fee?.basis), conditions: text(fee?.conditions), authority: text(fee?.authority),
      sourceUrl: url(fee?.sourceUrl), sourceUpdatedAt: text(fee?.sourceUpdatedAt),
    })).filter(fee => fee.name && fee.amount !== null && fee.currency && fee.sourceUrl),
    officialSources: list(guide.officialSources).map(source => ({
      authority: text(source?.authority), sourceType: ["government", "provider"].includes(source?.sourceType) ? source.sourceType : "airport",
      url: url(source?.url), supports: text(source?.supports),
    })).filter(source => source.url && source.authority),
    lastVerified: verifiedAt,
    guideVersion: 2,
  };
}
