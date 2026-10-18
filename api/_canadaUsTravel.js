// Reviewed against the linked authorities on 2026-10-18. Change the version
// whenever these rules change. This is a conditional baseline, not clearance
// for a particular animal, state, carrier, or six-month travel history.
export const CANADA_US_RULE_VERSION = 'ca-us-2026-10-18-v1';
const country = value => String(value || '').trim().toLowerCase().replace(/\./g, '');
export function isCanadaUs(origin, destination) {
  return ['canada', 'ca', 'can'].includes(country(origin)) &&
    ['united states', 'united states of america', 'us', 'usa'].includes(country(destination));
}
export function routeRuleCacheKey(origin, destination, key) {
  const base = key || 'unspecified';
  return isCanadaUs(origin, destination) ? `${CANADA_US_RULE_VERSION}:${base}` : base;
}
const sources = {
  lowRisk: 'https://www.cdc.gov/importation/dogs/rabies-free-low-risk-countries.html',
  form: 'https://www.cdc.gov/importation/dogs/dog-import-form-instructions.html',
  dogs: 'https://inspection.canada.ca/en/animal-health/terrestrial-animals/exports/pets/dogs-usa',
  cats: 'https://inspection.canada.ca/en/animal-health/terrestrial-animals/exports/pets/export-cats-and-ferrets-united-states',
  entry: 'https://www.cdc.gov/importation/bringing-an-animal-into-the-us/index.html',
  state: 'https://www.aphis.usda.gov/pet-travel/another-country-to-us-import/cats',
};
function item(id, species, title, description, source, document = false) {
  return { rule_id: id, rule_version: CANADA_US_RULE_VERSION, title, description,
    applies_to: species, category: 'Entry requirements', requirement_type: 'entry',
    source_type: 'government', source_url: sources[source], requires_document: document,
    deadline_days_before: null, window_start_days: null, window_end_days: null,
    notes: 'Check the linked authority again before travel. State, territory and carrier requirements must be checked separately.' };
}
export function canadaUsBaseline() {
  return [
    item('dog-history', 'dog', 'Check your dog’s full six-month travel history',
      'Leaving from Canada does not establish low-risk eligibility. Confirm every country your dog visited in the past six months and where it was vaccinated. If any country was high-risk or the history is unknown, contact CDC and CFIA before booking; do not rely on the low-risk checklist or assume direct entry from Canada is allowed.', 'dogs'),
    item('dog-form', 'dog', 'Obtain the CDC Dog Import Form receipt',
      'Each dog needs its own receipt. For dogs only in rabies-free or low-risk countries during the past six months, you may complete the form on the travel day or earlier; CDC recommends a few days or up to six months ahead. The receipt lasts six months from issuance for repeat entry from the same departure country, provided the dog remains eligible. A different departure country, expired receipt or high-risk travel requires reassessment. Show the receipt to border officials and, for air travel, the airline.', 'lowRisk', true),
    item('dog-chip', 'dog', 'Check your dog’s age, health and microchip',
      'Your dog must be at least six months old, appear healthy on arrival and have a microchip readable by a universal scanner. The low-risk CDC Dog Import Form does not ask for the microchip number. High-risk documentation has different requirements; do not apply that exemption to high-risk travel.', 'form'),
    item('dog-certificate', 'dog', 'Confirm any additional dog certificates',
      'A CFIA-endorsed export health certificate is not a universal requirement for every dog leaving Canada for the U.S. For eligible low-risk dogs, the CDC Dog Import Form is the only CDC document required. Check applicable USDA, destination state or territory and carrier rules separately; obtain certificates only as required for your situation.', 'dogs'),
    item('cat-certificate', 'cat', 'Check required cat documents with your veterinarian',
      'CFIA endorsement is not required for cats traveling from Canada to the United States. A Canadian licensed veterinarian can issue any documentation required by the applicable authorities. Confirm destination state or territory and carrier requirements separately.', 'cats'),
    item('cat-entry', 'cat', 'Make sure your cat is healthy for entry',
      'Cats must appear healthy and are subject to inspection at U.S. ports of entry, including land borders. An ill cat may need a veterinary examination at your expense or may be denied entry. CDC does not require proof of rabies vaccination for cats, but recommends vaccination; local requirements may differ.', 'entry'),
    item('cat-state', 'cat', 'Check your destination’s cat rules before travel',
      'USDA APHIS Veterinary Services has no animal-health import requirements for domestic pet cats, but that does not remove CDC, other federal, state or territory rules. Check your destination authority for vaccination, certificates and quarantine requirements. Hawaii and Guam have local quarantine rules. Check carrier policies separately.', 'state'),
  ];
}
// The model may add logistics, but cannot rewrite the protected legal baseline.
// Conservative overlap rejection is intentional: do not quietly discard a
// conflicting item or present it alongside corrected guidance.
const protectedTopic = /cfia|cdc|aphis|certificate|endorse|microchip|rabies|vaccin|quarantin|import\s*form|entry\s*require|no\s+(?:additional|separate|other|\w+\s+)*requirements?|appear\s+healthy|health\s*(?:check|inspection)|six.month|6.month/i;
export function validateCanadaUsExtras(items) {
  if (!Array.isArray(items)) throw new Error('Canada–U.S. checklist must be an array');
  for (const entry of items) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry) ||
        !['dog', 'cat', 'both'].includes(entry.applies_to) ||
        typeof entry.title !== 'string' || typeof entry.description !== 'string' ||
        !['airline_policy', 'airport_logistics'].includes(entry.requirement_type) ||
        entry.source_type !== (entry.requirement_type === 'airline_policy' ? 'airline' : 'airport') ||
        typeof entry.source_url !== 'string' || !entry.source_url.startsWith('https://')) {
      throw new Error('Canada–U.S. checklist item is malformed');
    }
    // Read every field, including notes and numeric timing metadata in the
    // canonical comparison below. A warning label is not a legal correction.
    if (protectedTopic.test(JSON.stringify(entry))) {
      throw new Error('Canada–U.S. generated guidance overlaps protected rules; verify the official requirements and try again');
    }
  }
  return items;
}
export function finalizeCanadaUs(items, origin, destination) {
  if (!isCanadaUs(origin, destination)) return items;
  return [...canadaUsBaseline(), ...validateCanadaUsExtras(items)];
}
export function validCanadaUsCache(items, origin, destination) {
  if (!isCanadaUs(origin, destination)) return true;
  if (!Array.isArray(items)) return false;
  const baseline = canadaUsBaseline();
  // Exact comparison prevents spoofed/stale rule IDs and changed timing fields.
  if (baseline.some((entry, i) => JSON.stringify(entry) !== JSON.stringify(items[i]))) return false;
  try { validateCanadaUsExtras(items.slice(baseline.length)); return true; } catch { return false; }
}
export function canadaUsResearchInstruction(origin, destination) {
  if (!isCanadaUs(origin, destination)) return '';
  return `\nCANADA TO UNITED STATES SERVER RULES: The server supplies a reviewed conditional legal baseline for both dogs and cats covering CFIA, CDC, APHIS, certificates, endorsement, microchips, age, health inspection, rabies, vaccination, quarantine, six-month history, entry requirements, and CDC form timing. Do NOT generate or repeat these topics, even if requested above. Return ONLY additional carrier/airport/booking logistics with official HTTPS source_url, applies_to dog, cat or both, requirement_type airline_policy or airport_logistics and corresponding source_type airline or airport. Return [] if there are none. Do not imply this is complete travel clearance. The server will add these mandatory items: ${JSON.stringify(canadaUsBaseline())}`;
}
