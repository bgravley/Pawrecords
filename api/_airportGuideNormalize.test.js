import test from "node:test";
import assert from "node:assert/strict";
import { normalizeAirportGuide } from "./_airportGuideNormalize.js";

test("normalizes guide data and keeps only usable official-source links", () => {
  const result = normalizeAirportGuide({ airportName: " Test Airport ", petReliefAreas: [{ location: " Gate 2 ", type: "indoor" }], officialSources: [{ authority: "Airport Authority", sourceType: "airport", url: "https://airport.test/pets" }, { authority: "Blog", url: "javascript:alert(1)" }] }, "TST", "2026-08-09T00:00:00.000Z");
  assert.equal(result.airportName, "Test Airport");
  assert.equal(result.petReliefAreas[0].location, "Gate 2");
  assert.equal(result.officialSources.length, 1);
  assert.equal(result.lastVerified, "2026-08-09T00:00:00.000Z");
});
