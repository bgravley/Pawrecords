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

test("normalizes conveniences, structured contacts, exact fees, and source state", () => {
  const result = normalizeAirportGuide({ terminalMapUrl: "https://airport.test/map", sourceStatus: "confirmed_official", contacts: [{ organization: "Airport Vet", type: "emergency_vet", phone: "+1 555", sourceUrl: "https://airport.test/vet" }], officialFees: [{ name: "Inspection", amount: "25", currency: "USD", basis: "per pet", sourceUrl: "https://gov.test/fee" }], officialSources: [{ authority: 'Airport', sourceType: 'airport', url: 'https://airport.test' }] }, "TST");
  assert.equal(result.terminalMapUrl, "https://airport.test/map");
  assert.equal(result.contacts[0].organization, "Airport Vet");
  assert.equal(result.officialFees[0].amount, 25);
  assert.equal(result.sourceStatus, "confirmed_official");
});

test("drops estimated or unsourced airport fees", () => {
  const result = normalizeAirportGuide({ officialFees: [{ name: "Maybe", amount: 20, currency: "USD" }, { name: "Range", amount: "20-30", currency: "USD", sourceUrl: "https://gov.test" }] }, "TST");
  assert.deepEqual(result.officialFees, []);
});
