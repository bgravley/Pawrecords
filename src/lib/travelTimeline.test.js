import test from "node:test";
import assert from "node:assert/strict";
import { calculateRequirementWindow, groupTimelineItems, inferTimelineStage, parseInstructionSteps, requirementToTimelineItem } from "./travelTimeline.js";

test("preserves explicit travel-event stages", () => {
  assert.equal(inferTimelineStage({ timeline_stage: "transit" }), "transit");
  assert.equal(inferTimelineStage({ timeline_stage: "arrival" }), "arrival");
});

test("assigns legacy tasks to a compatible timeline stage", () => {
  const now = new Date("2026-01-01T12:00:00Z");
  assert.equal(inferTimelineStage({ deadline_date: "2026-01-01" }, "2026-03-01", now), "days_30_90");
  assert.equal(inferTimelineStage({ deadline_date: "2026-03-01" }, "2026-03-01", now), "departure_day");
  assert.equal(inferTimelineStage({}, "2026-03-01", now), "start_now");
});

test("hides empty stages by returning empty arrays", () => {
  const grouped = groupTimelineItems([{ id: 1, timeline_stage: "arrival" }], "2026-03-01");
  assert.equal(grouped.arrival.length, 1);
  assert.equal(grouped.transit.length, 0);
});

test("keeps numbered instructions paired with their text", () => {
  assert.deepEqual(parseInstructionSteps("1. Book the appointment\n2. Bring the microchip record\n3. Save a copy"), ["Book the appointment", "Bring the microchip record", "Save a copy"]);
  assert.deepEqual(parseInstructionSteps("Step 1: Call the airline Step 2: Confirm the reservation"), ["Call the airline", "Confirm the reservation"]);
});

test("calculates a reviewed before-arrival window from structured timing", () => {
  assert.deepEqual(calculateRequirementWindow({
    timing_direction: "before_arrival",
    timing_min: 0,
    timing_max: 10,
    timing_unit: "days",
  }, { departureDate: "2026-11-18", arrivalDate: "2026-11-20" }), {
    window_start_date: "2026-11-10",
    window_end_date: "2026-11-20",
    deadline_date: "2026-11-20",
    timing_reference: "arrival",
  });
});

test("does not invent dates for rules tied to an unknown earlier event", () => {
  const item = requirementToTimelineItem({
    title: "Wait after the primary rabies vaccination",
    timing_direction: "after_event",
    timing_min: 21,
    timing_max: 21,
    timing_unit: "days",
  }, { departureDate: "2026-11-18" });
  assert.equal(item.deadline_date, undefined);
  assert.equal(item.timeline_stage, "start_now");
});
