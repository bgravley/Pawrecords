export const TIMELINE_STAGES = [
  { key: "start_now", label: "Start now" },
  { key: "months_6_12", label: "6–12 months" },
  { key: "months_3_6", label: "3–6 months" },
  { key: "days_30_90", label: "30–90 days" },
  { key: "days_10_30", label: "10–30 days" },
  { key: "within_10_days", label: "Within 10 days" },
  { key: "hours_72", label: "72 hours" },
  { key: "departure_day", label: "Departure day" },
  { key: "transit", label: "Transit" },
  { key: "arrival", label: "Arrival" },
  { key: "after_arrival", label: "After arrival" },
];

const VALID_STAGES = new Set(TIMELINE_STAGES.map(stage => stage.key));

export function inferTimelineStage(item, departureDate, now = new Date()) {
  if (VALID_STAGES.has(item?.timeline_stage)) return item.timeline_stage;
  if (!item?.deadline_date) return "start_now";
  const deadline = new Date(`${item.deadline_date}T12:00:00`);
  const departure = departureDate ? new Date(`${departureDate}T12:00:00`) : null;
  if (departure && deadline > departure) return "after_arrival";
  if (departure && deadline.toDateString() === departure.toDateString()) return "departure_day";
  const days = departure ? Math.ceil((departure - deadline) / 86400000) : Math.ceil((deadline - now) / 86400000);
  if (days <= 3) return "hours_72";
  if (days <= 10) return "within_10_days";
  if (days <= 30) return "days_10_30";
  if (days <= 90) return "days_30_90";
  if (days <= 183) return "months_3_6";
  if (days <= 365) return "months_6_12";
  return "start_now";
}

export function groupTimelineItems(items, departureDate, now = new Date()) {
  const grouped = Object.fromEntries(TIMELINE_STAGES.map(stage => [stage.key, []]));
  for (const item of items || []) grouped[inferTimelineStage(item, departureDate, now)].push(item);
  for (const values of Object.values(grouped)) values.sort((a, b) => (a.deadline_date || "9999").localeCompare(b.deadline_date || "9999") || (a.sort_order || 0) - (b.sort_order || 0));
  return grouped;
}

export function parseInstructionSteps(value) {
  const text = String(value || "").trim();
  if (!text) return [];
  const matches = [...text.matchAll(/(?:^|\s)(?:Step\s+)?\d+[.):]\s+/gi)];
  if (!matches.length) return [text];
  return matches.map((match, index) => {
    const start = match.index + match[0].length;
    const end = matches[index + 1]?.index ?? text.length;
    return text.slice(start, end).trim();
  }).filter(Boolean);
}


// Deterministic date math for the reviewed structured knowledge layer.
// AI may research a missing rule, but deadline arithmetic is calculated here.
const KNOWLEDGE_DAY_MS = 24 * 60 * 60 * 1000;
const knowledgeDate = value => {
  if (!value) return null;
  const d = new Date(`${String(value).slice(0,10)}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
};
const addKnowledgeTime = (date, amount, unit) => {
  const d = new Date(date.getTime());
  if (unit === 'hours') return new Date(d.getTime() + amount * 60 * 60 * 1000);
  if (unit === 'days') return new Date(d.getTime() + amount * KNOWLEDGE_DAY_MS);
  if (unit === 'weeks') return new Date(d.getTime() + amount * 7 * KNOWLEDGE_DAY_MS);
  if (unit === 'months') { d.setUTCMonth(d.getUTCMonth() + amount); return d; }
  return null;
};
const knowledgeIso = d => d ? d.toISOString().slice(0,10) : null;

export function calculateRequirementWindow(requirement, { departureDate, arrivalDate } = {}) {
  if (!requirement?.timing_unit || !requirement?.timing_direction) return { calculable:false, reason:'No structured timing rule' };
  if (requirement.timing_direction === 'after_event' || requirement.timing_direction === 'valid_for') {
    return { calculable:false, reason:'Requires the triggering event date', timing_basis:requirement.timing_basis || null };
  }
  const anchor = requirement.timing_direction === 'before_arrival'
    ? knowledgeDate(arrivalDate || departureDate)
    : knowledgeDate(departureDate);
  if (!anchor) return { calculable:false, reason:'Travel date required' };
  const min = requirement.timing_min == null ? null : Number(requirement.timing_min);
  const max = requirement.timing_max == null ? null : Number(requirement.timing_max);
  return {
    calculable:true,
    anchor:knowledgeIso(anchor),
    earliest:max == null ? null : knowledgeIso(addKnowledgeTime(anchor,-max,requirement.timing_unit)),
    latest:min == null ? null : knowledgeIso(addKnowledgeTime(anchor,-min,requirement.timing_unit)),
    timing_unit:requirement.timing_unit,
    timing_direction:requirement.timing_direction,
  };
}

export function buildReviewedTravelTimeline(requirements, trip) {
  return (requirements || [])
    .map(requirement => ({ requirement, window:calculateRequirementWindow(requirement,trip) }))
    .filter(item => item.window.calculable)
    .sort((a,b)=>(a.window.latest || a.window.earliest || '').localeCompare(b.window.latest || b.window.earliest || ''));
}
