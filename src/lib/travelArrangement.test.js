import test from "node:test";
import assert from "node:assert/strict";
import {
  arrangementCacheKey,
  buildAirTravelPayload,
  cleanAirTravelDetails,
  describeAirTravelArrangements,
  normalizeAirTravelArrangements,
} from "./travelArrangement.js";

test("old trips without arrangement data remain compatible", () => {
  assert.deepEqual(normalizeAirTravelArrangements(null), { version: 1, by_pet: {} });
  assert.equal(arrangementCacheKey(null, ["pet-1"]), "not_decided");
});

test("not decided removes irrelevant conditional fields", () => {
  assert.deepEqual(cleanAirTravelDetails({ arrangement: "not_decided", kennel_dimensions: "40x20" }), {
    arrangement: "not_decided",
  });
});

test("switching arrangements removes fields from the previous mode", () => {
  assert.deepEqual(cleanAirTravelDetails({
    arrangement: "checked_pet",
    kennel_dimensions: "40 x 27 x 30 in",
    carrier_type: "soft",
    same_flight_confirmed: false,
  }), {
    arrangement: "checked_pet",
    kennel_dimensions: "40 x 27 x 30 in",
    same_flight_confirmed: false,
  });
});

test("service animal convenience choice does not alter the pet record", () => {
  const pet = { id: "pet-1", is_service_animal: false };
  const payload = buildAirTravelPayload([pet.id], {
    by_pet: { [pet.id]: { arrangement: "in_cabin_service_animal", seat_class: "Economy" } },
  });
  assert.equal(payload.by_pet[pet.id].service_animal_status, true);
  assert.equal(pet.is_service_animal, false);
});

test("cache key separates cabin, checked, and cargo checklists", () => {
  const arrangements = { by_pet: {
    a: { arrangement: "manifest_cargo" },
    b: { arrangement: "in_cabin_pet" },
    c: { arrangement: "manifest_cargo" },
  } };
  assert.equal(arrangementCacheKey(arrangements, ["a", "b", "c"]), "in_cabin_pet+manifest_cargo");
});

test("checklist input includes the selected mode and only relevant details", () => {
  const summary = describeAirTravelArrangements({ by_pet: {
    a: { arrangement: "manifest_cargo", air_waybill: "123-456", carrier_dimensions: "ignored" },
  } }, [{ id: "a", name: "Sadie" }]);
  assert.match(summary, /Sadie: Manifest cargo/);
  assert.match(summary, /air waybill: 123-456/);
  assert.doesNotMatch(summary, /carrier dimensions/);
});
