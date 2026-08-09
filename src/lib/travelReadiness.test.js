import test from "node:test";
import assert from "node:assert/strict";
import { effectiveReadinessStatus, readinessSummary } from "./travelReadiness.js";

test("uploaded evidence waits for review instead of becoming complete", () => assert.equal(effectiveReadinessStatus({ id: "task" }, [{ checklist_item_id: "task" }]), "uploaded_awaiting_review"));
test("expired evidence overrides a completed state", () => assert.equal(effectiveReadinessStatus({ is_completed: true, document_expires_at: "2025-12-31" }, [], new Date("2026-01-01T12:00:00Z")), "expired"));
test("critical tasks carry more readiness weight", () => assert.equal(readinessSummary([{ importance: "critical", is_completed: true }, { importance: "supporting" }]).percent, 75));
test("not-applicable tasks are excluded", () => assert.equal(readinessSummary([{ readiness_status: "not_applicable" }, { importance: "supporting", is_completed: true }]).percent, 100));
