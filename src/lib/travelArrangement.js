export const AIR_TRAVEL_ARRANGEMENTS = [
  { value: "in_cabin_pet", label: "In-cabin pet" },
  { value: "in_cabin_service_animal", label: "In-cabin service animal" },
  { value: "checked_pet", label: "Checked pet / accompanied baggage" },
  { value: "manifest_cargo", label: "Manifest cargo" },
  { value: "not_decided", label: "Not decided yet" },
];

export const emptyAirTravelDetails = (arrangement = "not_decided") => ({ arrangement });

export const normalizeAirTravelArrangements = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { version: 1, by_pet: {} };
  const byPet = value.by_pet && typeof value.by_pet === "object" && !Array.isArray(value.by_pet)
    ? value.by_pet
    : {};
  return { version: 1, by_pet: byPet };
};

export const cleanAirTravelDetails = (details = {}) => {
  const arrangement = AIR_TRAVEL_ARRANGEMENTS.some(option => option.value === details.arrangement)
    ? details.arrangement
    : "not_decided";
  if (arrangement === "not_decided") return { arrangement };

  const allowedByArrangement = {
    in_cabin_pet: ["carrier_dimensions", "combined_weight", "carrier_type", "service_animal_status", "seat_class", "number_of_pets"],
    in_cabin_service_animal: ["service_animal_status", "seat_class", "number_of_pets"],
    checked_pet: ["kennel_dimensions", "kennel_construction", "combined_weight", "same_flight_confirmed", "temperature_concerns", "breed_restrictions"],
    manifest_cargo: ["cargo_reservation_status", "air_waybill", "freight_agent", "cargo_terminal", "consignee", "customs_broker"],
  };
  const cleaned = { arrangement };
  for (const key of allowedByArrangement[arrangement] || []) {
    const value = details[key];
    if (value !== "" && value !== null && value !== undefined) cleaned[key] = value;
  }
  if (arrangement === "in_cabin_service_animal") cleaned.service_animal_status = true;
  return cleaned;
};

export const buildAirTravelPayload = (selectedPetIds, arrangements) => {
  const normalized = normalizeAirTravelArrangements(arrangements);
  return {
    version: 1,
    by_pet: Object.fromEntries(
      selectedPetIds.map(petId => [petId, cleanAirTravelDetails(normalized.by_pet[petId] || {})])
    ),
  };
};

export const arrangementCacheKey = (arrangements, selectedPetIds = []) => {
  const normalized = normalizeAirTravelArrangements(arrangements);
  const modes = selectedPetIds
    .map(id => cleanAirTravelDetails(normalized.by_pet[id] || {}).arrangement)
    .sort();
  return modes.length ? [...new Set(modes)].join("+") : "unspecified";
};

export const describeAirTravelArrangements = (arrangements, pets) => {
  const normalized = normalizeAirTravelArrangements(arrangements);
  const labels = Object.fromEntries(AIR_TRAVEL_ARRANGEMENTS.map(option => [option.value, option.label]));
  return pets.map(pet => {
    const details = cleanAirTravelDetails(normalized.by_pet[pet.id] || {});
    const fields = Object.entries(details)
      .filter(([key]) => key !== "arrangement")
      .map(([key, value]) => `${key.replaceAll("_", " ")}: ${typeof value === "boolean" ? (value ? "yes" : "no") : value}`)
      .join(", ");
    return `${pet.name}: ${labels[details.arrangement]}${fields ? ` (${fields})` : ""}`;
  }).join("; ");
};
