import test from "node:test";
import assert from "node:assert/strict";
import { buildAirportStops } from "./airportGuide.js";

test("builds departure, every layover, and arrival in itinerary order", () => {
  const legs = [
    { transportation_type: "air", origin_airport_code: "jfk", destination_airport_code: "LHR" },
    { transportation_type: "air", origin_airport_code: "LHR", destination_airport_code: "CDG" },
    { transportation_type: "air", origin_airport_code: "CDG", destination_airport_code: "FCO" },
  ];
  assert.deepEqual(buildAirportStops(legs).map(({ code, role }) => ({ code, role })), [
    { code: "JFK", role: "departure" },
    { code: "LHR", role: "layover" },
    { code: "CDG", role: "layover" },
    { code: "FCO", role: "arrival" },
  ]);
});

test("ignores land legs and missing codes", () => {
  assert.deepEqual(buildAirportStops([{ transportation_type: "land", origin_airport_code: "JFK" }]), []);
  assert.deepEqual(buildAirportStops([{ transportation_type: "air" }]), []);
});

test("reuses an airport and records each role", () => {
  const stops = buildAirportStops([{ transportation_type: "air", origin_airport_code: "BOG", destination_airport_code: "BOG" }]);
  assert.deepEqual(stops, [{ code: "BOG", role: "departure", roles: ["departure", "arrival"] }]);
});
