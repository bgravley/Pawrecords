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

const UNIT_DAYS = { hours: 1 / 24, days: 1, weeks: 7, months: 30 };

function dateAtNoon(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return null;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isoDate(date) {
  return date?.toISOString().slice(0, 10) || null;
}

function shiftDays(date, days) {
  return new Date(date.getTime() + Math.round(days * 86400000));
}

// Turns a reviewed structured timing rule into a trip-specific window. Rules
// tied to an earlier event (for example, "21 days after primary rabies") stay
// in Start now because the trip record does not prove that event's date.
export function calculateRequirementWindow(requirement, { departureDate, arrivalDate } = {}) {
  const direction = requirement?.timing_direction;
  if (!['before_departure', 'before_arrival'].includes(direction)) return null;
  const target = dateAtNoon(direction === 'before_arrival' ? (arrivalDate || departureDate) : departureDate);
  const unitDays = UNIT_DAYS[requirement?.timing_unit];
  const minimum = Number(requirement?.timing_min);
  const maximum = Number(requirement?.timing_max);
  if (!target || !unitDays || !Number.isFinite(minimum) || !Number.isFinite(maximum) || minimum < 0 || maximum < minimum) return null;

  const windowStart = shiftDays(target, -maximum * unitDays);
  const windowEnd = shiftDays(target, -minimum * unitDays);
  return {
    window_start_date: isoDate(windowStart),
    window_end_date: isoDate(windowEnd),
    deadline_date: isoDate(windowEnd),
    timing_reference: direction === 'before_arrival' ? 'arrival' : 'departure',
  };
}

export function requirementToTimelineItem(requirement, tripDates = {}, now = new Date()) {
  const window = calculateRequirementWindow(requirement, tripDates);
  const item = {
    ...requirement,
    ...(window || {}),
  };
  return {
    ...item,
    timeline_stage: window
      ? inferTimelineStage(item, tripDates.departureDate, now)
      : (VALID_STAGES.has(requirement?.timeline_stage) ? requirement.timeline_stage : 'start_now'),
  };
}
