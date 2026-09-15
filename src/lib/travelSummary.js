import { AIR_TRAVEL_ARRANGEMENTS, normalizeAirTravelArrangements } from './travelArrangement.js';
import { feeLabel, normalizeTravelSupport, serviceAnimalWorkflows, travelSupportReferenceRows } from './travelSupport.js';
import { safeExternalUrl } from './safeExternalUrl.js';

export const SHARE_DURATION_DAYS = 30;

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatTravelDate(value) {
  if (!value) return 'Not added';
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

export function arrangementLabel(value) {
  return AIR_TRAVEL_ARRANGEMENTS.find(option => option.value === value)?.label || 'Not decided yet';
}

export function petTravelDetails(trip, pets = []) {
  const arrangements = normalizeAirTravelArrangements(trip?.air_travel_arrangements);
  return pets.map(pet => ({
    ...pet,
    travel_arrangement: arrangements.by_pet?.[pet.id]?.arrangement || 'not_decided',
    travel_arrangement_label: arrangementLabel(arrangements.by_pet?.[pet.id]?.arrangement),
  }));
}

export function categorizeTravelDocuments(documents = []) {
  const groups = { health: [], permits: [], labs: [], other: [] };
  for (const document of documents) {
    const text = `${document.doc_type || ''} ${document.name || ''}`.toLowerCase();
    if (/permit|import|export|customs|entry|authorization/.test(text)) groups.permits.push(document);
    else if (/lab|titer|titre|test|serology/.test(text)) groups.labs.push(document);
    else if (/health|vaccine|vaccination|rabies|certificate|vet/.test(text)) groups.health.push(document);
    else groups.other.push(document);
  }
  return groups;
}

function rows(items) {
  return items.map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value || 'Not added')}</td></tr>`).join('');
}

function section(title, body) {
  return `<section><h2>${escapeHtml(title)}</h2>${body}</section>`;
}

export function buildTravelSummaryHtml({ trip, legs = [], pets = [], documents = [], checklist = [], shareUrl = '' }) {
  const petDetails = petTravelDetails(trip, pets);
  const groupedDocs = categorizeTravelDocuments(documents);
  const support = normalizeTravelSupport(trip.travel_support);
  const officialFees = checklist.filter(item => feeLabel(item));
  const workflows = serviceAnimalWorkflows(trip, pets);
  const title = trip.name || `${trip.origin_city} to ${trip.destination_city}`;
  const itinerary = (legs.length ? legs : [{
    origin_city: trip.origin_city, origin_country: trip.origin_country,
    destination_city: trip.destination_city, destination_country: trip.destination_country,
    departure_date: trip.departure_date, airline: trip.airline, flight_number: trip.flight_number,
    transportation_type: trip.transportation_type,
  }]).map((leg, index) => `<article class="leg"><strong>${index + 1}. ${escapeHtml(leg.origin_city)}${leg.origin_airport_code ? ` (${escapeHtml(leg.origin_airport_code)})` : ''} to ${escapeHtml(leg.destination_city)}${leg.destination_airport_code ? ` (${escapeHtml(leg.destination_airport_code)})` : ''}</strong><span>${escapeHtml(formatTravelDate(leg.departure_date))} · ${escapeHtml(leg.airline || leg.transportation_type || 'Travel')} ${escapeHtml(leg.flight_number || '')}</span></article>`).join('');
  const petCards = petDetails.map(pet => `<article class="pet">${pet.photo_url ? `<img src="${escapeHtml(pet.photo_url)}" alt="">` : '<div class="pet-photo">🐾</div>'}<div><strong>${escapeHtml(pet.name)}</strong><span>${escapeHtml([pet.species, pet.breed].filter(Boolean).join(' · ') || 'Pet')}</span><span>Microchip: ${escapeHtml(pet.microchip || 'Not added')}</span><span>Status: ${escapeHtml(pet.pet_type === 'service_animal' || pet.is_service_animal ? 'Service animal' : pet.pet_type === 'esa' || pet.is_esa ? 'Emotional support animal' : 'Pet')}</span><span>Travel: ${escapeHtml(pet.travel_arrangement_label)}</span>${pet.emergency_contact || pet.emergency_phone ? `<span>Emergency: ${escapeHtml([pet.emergency_contact, pet.emergency_phone].filter(Boolean).join(' · '))}</span>` : ''}</div></article>`).join('');
  const documentSection = Object.entries(groupedDocs).map(([group, docs]) => docs.length ? `<h3>${escapeHtml(group[0].toUpperCase() + group.slice(1))}</h3><ul>${docs.map(doc => `<li><strong>${escapeHtml(doc.name)}</strong>${doc.doc_date ? ` · ${escapeHtml(formatTravelDate(doc.doc_date))}` : ''}</li>`).join('')}</ul>` : '').join('') || '<p>No travel documents added yet.</p>';
  const requirementRows = checklist.map(item => { const sourceUrl = safeExternalUrl(item.source_url); return `<tr><th>${escapeHtml(item.title)}</th><td>${escapeHtml(item.readiness_status || (item.is_completed ? 'complete' : 'missing')).replace(/_/g, ' ')}</td><td>${sourceUrl ? `<a href="${escapeHtml(sourceUrl)}">${escapeHtml(item.source_authority || 'Official source')}</a>` : 'Source needed'}</td></tr>`; }).join('');
  const referenceRows = travelSupportReferenceRows(support).map(([label, value]) => [label, label === 'Contacts checked' ? formatTravelDate(value) : value]);
  const destinationVet = Object.values(support.destination_vet).some(Boolean) ? `<h3>Destination veterinarian</h3><p>${escapeHtml([support.destination_vet.name, support.destination_vet.clinic, support.destination_vet.phone, support.destination_vet.email].filter(Boolean).join(' · '))}</p>` : '';
  const serviceRows = workflows.map(({ pet, details }) => `<li><strong>${escapeHtml(pet.name)}</strong> · DOT form ${escapeHtml((details.dot_form_status || 'not started').replace(/_/g, ' '))} · Relief form ${escapeHtml((details.relief_attestation_status || 'not applicable').replace(/_/g, ' '))}${details.airline_confirmation_reference ? ` · Confirmation ${escapeHtml(details.airline_confirmation_reference)}` : ''}</li>`).join('');
  const fees = officialFees.map(item => { const sourceUrl = safeExternalUrl(item.source_url); return `<li><strong>${escapeHtml(item.title)}: ${escapeHtml(feeLabel(item))}</strong>${item.fee_basis ? ` · ${escapeHtml(item.fee_basis)}` : ''}<br><small>Checked ${escapeHtml(formatTravelDate(item.fee_last_checked_at || item.researched_at))}${item.fee_source_updated_at ? ` · Source updated ${escapeHtml(formatTravelDate(item.fee_source_updated_at))}` : ''}${sourceUrl ? ` · <a href="${escapeHtml(sourceUrl)}">Official source</a>` : ' · Source unavailable'}. Additional fees may apply.</small></li>`; }).join('');
  const travelReferences = referenceRows.length || destinationVet || serviceRows || fees ? `${referenceRows.length ? `<table><tbody>${rows(referenceRows)}</tbody></table>` : ''}${destinationVet}${serviceRows ? `<h3>U.S. service-animal documents</h3><ul>${serviceRows}</ul>` : ''}${fees ? `<h3>Known official fees</h3><ul>${fees}</ul><p class="notice">Fees are individual published amounts, not an estimated trip total. Confirm before payment.</p>` : ''}` : '<p>No additional pet-travel references added.</p>';

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} - Travel Summary</title><style>
  :root{color:#1A2E22;background:#FAFCFB;font-family:Lora,Georgia,serif}*{box-sizing:border-box}body{margin:0}.page{max-width:800px;margin:auto;padding:32px 24px}.hero{background:#2C4A38;color:white;border-radius:20px;padding:28px}.hero small{color:#9DC4AA}.hero h1{font-family:Georgia,serif;margin:6px 0 8px;font-size:30px}.route{color:#EAF4EE}.meta{display:flex;gap:16px;flex-wrap:wrap;margin-top:16px;color:#EAF4EE;font-size:13px}section{background:white;border:1px solid #DCE8E0;border-radius:16px;padding:20px;margin-top:16px}h2{font-family:Georgia,serif;color:#2C4A38;margin:0 0 14px;font-size:20px}h3{color:#5C7464;font-size:12px;text-transform:uppercase;letter-spacing:.08em;margin:16px 0 6px}.leg,.pet{display:flex;gap:12px;padding:12px 0;border-bottom:1px solid #EAF4EE}.leg:last-child,.pet:last-child{border:0}.leg{justify-content:space-between}.leg span,.pet span{display:block;color:#5C7464;font-size:12px;margin-top:3px}.pet img,.pet-photo{width:60px;height:60px;border-radius:50%;object-fit:cover;background:#EAF4EE;display:grid;place-items:center;font-size:24px;flex:0 0 auto}table{width:100%;border-collapse:collapse;font-size:13px}th,td{text-align:left;vertical-align:top;padding:9px;border-bottom:1px solid #EAF4EE}th{color:#2C4A38}a{color:#2C4A38}.notice{font-size:12px;color:#5C7464;line-height:1.6}.brand{color:#C9A84C;font-weight:700}ul{padding-left:20px}li{margin:7px 0;font-size:13px}@media(max-width:560px){.page{padding:14px}.hero{padding:22px}.leg{display:block}.leg span{margin-top:5px}th,td{display:block;padding:5px 0}tr{display:block;padding:8px 0;border-bottom:1px solid #EAF4EE}th,td{border:0}}@media print{body{background:#fff}.page{max-width:none;padding:0}.hero{border-radius:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}section{break-inside:avoid;border-color:#cbd8cf}.no-print{display:none!important}}
  </style></head><body><main class="page"><header class="hero"><small>YOURPETPASS · HEALTH RECORDS & TRAVEL, SIMPLIFIED.</small><h1>${escapeHtml(title)}</h1><div class="route">${escapeHtml(trip.origin_city)}, ${escapeHtml(trip.origin_country)} to ${escapeHtml(trip.destination_city)}, ${escapeHtml(trip.destination_country)}</div><div class="meta"><span>Departure: ${escapeHtml(formatTravelDate(trip.departure_date))}</span><span>Return: ${escapeHtml(formatTravelDate(trip.return_date))}</span><span>Overall travel: ${escapeHtml(trip.transportation_type || 'air')}</span></div></header>
  ${section('Itinerary', itinerary)}${section('Traveling pets', petCards || '<p>No pets selected.</p>')}${section('Travel references', travelReferences)}${section('Health documents, permits & labs', documentSection)}${section('Requirements status', requirementRows ? `<table><tbody>${requirementRows}</tbody></table>` : '<p>No requirements added yet.</p>')}${safeExternalUrl(shareUrl) ? section('Secure shared view', `<p class="notice">This private link expires automatically. Only share it with people helping with this trip.<br><a href="${escapeHtml(safeExternalUrl(shareUrl))}">${escapeHtml(safeExternalUrl(shareUrl))}</a></p>`) : ''}<section class="notice"><span class="brand">YourPetPass</span> keeps your pet's travel details together. Always verify country rules and fees with the responsible government authority and airline or airport logistics with their official sources.</section></main></body></html>`;
}
