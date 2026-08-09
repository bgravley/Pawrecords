export const SOURCE_TYPES = ["government", "airline", "airport"];
export const REVIEW_STATUSES = [["pending", "Pending review"], ["verified", "Human verified"], ["needs_review", "Needs review"], ["rejected", "Rejected"]];

export function expectedSourceType(item = {}) {
  if (item.requirement_type === "airline_policy" || item.category === "airline") return "airline";
  if (item.requirement_type === "airport_logistics") return "airport";
  return "government";
}

export function sourceVerificationState(item = {}, now = new Date()) {
  if (item.change_detected) return { state: "changed", label: "Change detected" };
  if (item.source_expires_at && new Date(`${item.source_expires_at}T23:59:59`) < now) return { state: "warning", label: "Source expired" };
  if (item.human_review_status === "rejected") return { state: "warning", label: "Source rejected" };
  if (!/^https:\/\//i.test(item.source_url || "")) return { state: "warning", label: "Official source needed" };
  const expected = expectedSourceType(item);
  if (item.source_type && item.source_type !== expected) return { state: "warning", label: `Use an official ${expected} source` };
  if (item.human_review_status === "verified") return { state: "verified", label: "Human verified" };
  return { state: "pending", label: "Official source — review pending" };
}
