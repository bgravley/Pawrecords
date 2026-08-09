export const READINESS_STATUSES = [
  ["missing", "Missing"], ["uploaded_awaiting_review", "Uploaded — awaiting review"],
  ["needs_correction", "Needs correction"], ["complete", "Complete"],
  ["not_applicable", "Not applicable"], ["blocked", "Blocked"], ["expired", "Expired"],
];
export const READINESS_LABELS = Object.fromEntries(READINESS_STATUSES);
const STATUS_CREDIT = { missing: 0, uploaded_awaiting_review: 0.5, needs_correction: 0.25, complete: 1, blocked: 0, expired: 0 };

export function effectiveReadinessStatus(item, documents = [], now = new Date()) {
  if (item?.readiness_status === "not_applicable") return "not_applicable";
  if (item?.document_expires_at && new Date(`${item.document_expires_at}T23:59:59`) < now) return "expired";
  if (["needs_correction", "blocked", "expired"].includes(item?.readiness_status)) return item.readiness_status;
  if (item?.is_completed || item?.readiness_status === "complete") return "complete";
  if (item?.readiness_status === "uploaded_awaiting_review" || documents.some(document => document.checklist_item_id === item?.id)) return "uploaded_awaiting_review";
  return "missing";
}

export function readinessSummary(items = [], documents = [], now = new Date()) {
  let earned = 0, possible = 0;
  const enriched = items.map(item => {
    const status = effectiveReadinessStatus(item, documents, now);
    const importance = item.importance === "supporting" ? "supporting" : "critical";
    const weight = Number(item.readiness_weight) > 0 ? Number(item.readiness_weight) : (importance === "critical" ? 3 : 1);
    if (status !== "not_applicable") { possible += weight; earned += weight * (STATUS_CREDIT[status] || 0); }
    return { ...item, effective_status: status, effective_importance: importance, effective_weight: weight };
  });
  const incomplete = item => !["complete", "not_applicable"].includes(item.effective_status);
  const upcoming = enriched.filter(incomplete).filter(item => item.deadline_date && new Date(`${item.deadline_date}T23:59:59`) >= now && new Date(`${item.deadline_date}T23:59:59`) <= new Date(now.getTime() + 30 * 86400000)).sort((a, b) => a.deadline_date.localeCompare(b.deadline_date));
  return { percent: possible ? Math.round(earned / possible * 100) : 0, items: enriched, criticalMissing: enriched.filter(item => item.effective_importance === "critical" && incomplete(item)), documentIssues: enriched.filter(item => ["uploaded_awaiting_review", "needs_correction", "expired"].includes(item.effective_status)), upcoming };
}
