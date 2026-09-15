import { normalizeAirTravelArrangements } from './travelArrangement.js';

export const PACKING_CATEGORIES = [
  ['documents', 'Documents'], ['food_water', 'Food & water'], ['medication', 'Medication'],
  ['carrier_kennel', 'Carrier or kennel'], ['leash_harness', 'Leash & harness'],
  ['comfort', 'Comfort'], ['cleaning', 'Cleaning'], ['arrival', 'Arrival supplies'], ['emergency', 'Emergency items'],
];

const item = (id, category, title, detail, appliesTo = 'All pets') => ({ id, category, title, detail, appliesTo });

export function buildPackingItems(trip = {}, pets = []) {
  const arrangements = normalizeAirTravelArrangements(trip.air_travel_arrangements);
  const methods = new Set(pets.map(pet => arrangements.by_pet?.[pet.id]?.arrangement || 'not_decided'));
  const isAir = (trip.transportation_type || 'air') === 'air';
  const items = [
    item('documents-record-copies', 'documents', 'Printed and digital travel-document copies', 'Keep one set with you and one backup stored separately.'),
    item('documents-pet-id', 'documents', 'Pet ID and microchip details', 'Include a recent photo and your current contact information.'),
    item('food-meals', 'food_water', 'Measured food for the journey and delays', 'Pack familiar food plus at least one extra day when practical.'),
    item('food-water', 'food_water', 'Water and travel-safe bowls', 'Offer water according to your veterinarian and carrier guidance.'),
    item('medication', 'medication', 'Medication in original labeled packaging', 'Carry dosing instructions and enough for reasonable delays.'),
    item('leash-primary', 'leash_harness', 'Secure leash, harness and backup restraint', 'Check fit before departure; never open a carrier in an unsecured area.'),
    item('comfort-scent', 'comfort', 'Familiar, safe comfort item', 'Use only an item your carrier or kennel can safely accommodate.'),
    item('cleaning-kit', 'cleaning', 'Waste bags, absorbent pads and cleaning supplies', 'Keep a small cleanup kit accessible during transit.'),
    item('arrival-food', 'arrival', 'First-day food, water and medication', 'Keep arrival essentials outside checked luggage.'),
    item('emergency-contacts', 'emergency', 'Airline, cargo, government and emergency-vet contacts', 'Save them offline before leaving.'),
    item('emergency-backups', 'emergency', 'Backup document copies and emergency funds', 'Keep these separate from the primary travel folder.'),
  ];
  if (isAir && (methods.has('in_cabin_pet') || methods.has('in_cabin_service_animal') || methods.has('not_decided'))) {
    items.push(item('cabin-carrier', 'carrier_kennel', 'Airline-compliant cabin carrier', 'Confirm dimensions, closure, ventilation and weight with the airline.'), item('cabin-seat-kit', 'comfort', 'Under-seat comfort and cleanup kit', 'Keep pads and a spare liner accessible without opening the carrier.'));
  }
  if (isAir && (methods.has('checked_pet') || methods.has('manifest_cargo'))) {
    items.push(item('kennel-hardware', 'carrier_kennel', 'Airline-approved rigid kennel and hardware', 'Confirm construction, ventilation, fasteners and labeling with the airline or cargo operator.'), item('kennel-bowls', 'carrier_kennel', 'Attached food and water bowls', 'Follow the carrier or cargo operator instructions for filling and access.'), item('kennel-labels', 'documents', 'Kennel labels and handling documents', 'Attach only the labels and originals required for this itinerary.'));
  }
  if (isAir && methods.has('manifest_cargo')) items.push(item('cargo-awb', 'documents', 'Cargo reservation and air waybill copies', 'Carry cargo terminal, shipper, consignee and customs-broker contacts.'), item('cargo-arrival-kit', 'arrival', 'Cargo-terminal pickup and customs folder', 'Keep pickup authorization and receiving-party identification accessible.'));
  if (isAir && methods.has('checked_pet')) items.push(item('checked-confirmation', 'documents', 'Same-flight pet confirmation', 'Reconfirm acceptance, weather restrictions and check-in location before departure.'));
  if (pets.some(pet => pet.pet_type === 'service_animal' || pet.is_service_animal)) items.push(item('service-animal-kit', 'documents', 'Service-animal airline forms and harness', 'Keep required forms and relief supplies accessible; classification stays separate from travel arrangement.', 'Service animal'));
  if (trip.transportation_type === 'land') items.push(item('road-safety', 'carrier_kennel', 'Crash-conscious vehicle restraint', 'Use a secure carrier or tested restraint and plan safe breaks.'));
  if (trip.transportation_type === 'sea') items.push(item('sea-policy', 'documents', 'Operator approval and onboard pet paperwork', 'Confirm boarding, relief and kennel arrangements with the vessel operator.'));
  if (trip.transportation_type === 'bus') items.push(item('bus-policy', 'documents', 'Bus operator pet approval', 'Keep the operator policy and any reservation confirmation accessible.'));
  return items;
}

export function packingProgress(items = [], state = {}) {
  const completed = state?.completed || {};
  const done = items.filter(entry => completed[entry.id] === true).length;
  return { done, total: items.length, percent: items.length ? Math.round(done / items.length * 100) : 0 };
}

export function missedConnectionGuidance(trip = {}, pets = []) {
  const arrangements = normalizeAirTravelArrangements(trip.air_travel_arrangements);
  const methods = new Set(pets.map(pet => arrangements.by_pet?.[pet.id]?.arrangement || 'not_decided'));
  if (methods.has('manifest_cargo')) return 'Contact the cargo operator before leaving the terminal. Confirm your pet\'s physical location, air waybill status, care arrangements, customs impact, and the receiving party before accepting a new routing.';
  if (methods.has('checked_pet')) return 'Tell the airline immediately that a checked pet is traveling. Confirm where your pet is being held, whether the pet remains on your rebooked flight, and who is responsible for water, temperature control, and any required recheck.';
  return 'Tell the airline you are traveling with a pet before accepting a new flight. Reconfirm cabin acceptance, connection time, relief access, and every transit-country rule for the new routing.';
}

