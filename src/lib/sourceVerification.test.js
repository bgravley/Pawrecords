import test from "node:test";
import assert from "node:assert/strict";
import { expectedSourceType, sourceVerificationState } from "./sourceVerification.js";

test("country and health requirements require government sources", () => assert.equal(expectedSourceType({ category: "health_certificate" }), "government"));
test("airline policy uses only an airline source", () => assert.equal(expectedSourceType({ requirement_type: "airline_policy" }), "airline"));
test("airport logistics uses an airport authority source", () => assert.equal(expectedSourceType({ requirement_type: "airport_logistics" }), "airport"));
test("mismatched sources are flagged", () => assert.equal(sourceVerificationState({ category: "entry_document", source_type: "airline", source_url: "https://airline.test" }).state, "warning"));
test("change detection takes priority", () => assert.equal(sourceVerificationState({ change_detected: true, source_url: "https://gov.test" }).state, "changed"));
test("expired source records are flagged", () => assert.equal(sourceVerificationState({ source_expires_at: "2025-12-31", source_url: "https://gov.test" }, new Date("2026-01-01T12:00:00Z")).label, "Source expired"));
