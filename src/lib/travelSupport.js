export const SERVICE_DOCUMENT_STATUSES = [
  ['not_started', 'Not started'], ['in_progress', 'In progress'],
  ['submitted', 'Submitted'], ['accepted', 'Accepted'], ['not_applicable', 'Not applicable'],
];

const text = value => typeof value === 'string' ? value.trim() : '';
const httpsUrl = value => /^https:\/\//i.test(text(value)) ? text(value) : '';
const US_JURISDICTIONS = ['United States', 'Puerto Rico', 'Guam', 'US Virgin Islands', 'U.S. Virgin Islands', 'American Samoa', 'Northern Mariana Islands', 'United States Virgin Islands'];

export function isUnitedStatesRoute(trip = {}) {
  return [trip.origin_country, trip.destination_country].some(country => US_JURISDICTIONS.includes(country) || US_JURISDICTIONS.some(value => String(country || '').includes(value)));
}

export function normalizeTravelSupport(value) {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    version: 1,
    airline_pet_confirmation_reference: text(input.airline_pet_confirmation_reference),
    customs_declaration_reference: text(input.customs_declaration_reference),
    inspection_authority: text(input.inspection_authority),
    inspection_location: text(input.inspection_location),
    contacts_checked_at: text(input.contacts_checked_at),
    airline_contact: {
      department: text(input.airline_contact?.department), phone: text(input.airline_contact?.phone),
      email: text(input.airline_contact?.email), website: httpsUrl(input.airline_contact?.website),
    },
    government_contact: {
      organization: text(input.government_contact?.organization), phone: text(input.government_contact?.phone),
      email: text(input.government_contact?.email), website: httpsUrl(input.government_contact?.website),
    },
    pet_transport: {
      organization: text(input.pet_transport?.organization), phone: text(input.pet_transport?.phone), website: httpsUrl(input.pet_transport?.website),
    },
    destination_vet: {
      name: text(input.destination_vet?.name), clinic: text(input.destination_vet?.clinic),
      phone: text(input.destination_vet?.phone), email: text(input.destination_vet?.email),
    },
  };
}

export function cleanTravelSupport(value) {
  const support = normalizeTravelSupport(value);
  return {
    ...support,
    airline_contact: Object.fromEntries(Object.entries(support.airline_contact).filter(([, value]) => value)),
    government_contact: Object.fromEntries(Object.entries(support.government_contact).filter(([, value]) => value)),
    pet_transport: Object.fromEntries(Object.entries(support.pet_transport).filter(([, value]) => value)),
    destination_vet: Object.fromEntries(Object.entries(support.destination_vet).filter(([, value]) => value)),
  };
}

export function feeLabel(item = {}) {
  if (item.fee_amount === null || item.fee_amount === undefined || item.fee_amount === '') return '';
  const amount = Number(item.fee_amount);
  if (!Number.isFinite(amount) || amount < 0) return '';
  const currency = /^[A-Z]{3}$/.test(item.fee_currency || '') ? item.fee_currency : '';
  return `${currency ? `${currency} ` : ''}${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function travelSupportReferenceRows(value) {
  const support = normalizeTravelSupport(value);
  return [
    ['Airline pet confirmation', support.airline_pet_confirmation_reference],
    ['Pet customs declaration', support.customs_declaration_reference],
    ['Pet inspection authority', support.inspection_authority],
    ['Pet inspection location', support.inspection_location],
    ['Airline animal handling', [support.airline_contact.department, support.airline_contact.phone, support.airline_contact.email].filter(Boolean).join(' · ')],
    ['Government inspection contact', [support.government_contact.organization, support.government_contact.phone, support.government_contact.email].filter(Boolean).join(' · ')],
    ['Local pet transport', [support.pet_transport.organization, support.pet_transport.phone].filter(Boolean).join(' · ')],
    ['Contacts checked', support.contacts_checked_at],
  ].filter(([, value]) => value);
}

export function serviceAnimalWorkflows(trip = {}, pets = []) {
  if (!isUnitedStatesRoute(trip)) return [];
  const byPet = trip.air_travel_arrangements?.by_pet || {};
  return pets.filter(pet => pet.is_service_animal || pet.pet_type === 'service_animal' || byPet[pet.id]?.arrangement === 'in_cabin_service_animal').map(pet => ({
    pet,
    details: byPet[pet.id] || {},
  }));
}
