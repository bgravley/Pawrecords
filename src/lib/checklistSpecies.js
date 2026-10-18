// Shared by generation, pet assignment, and each pet's checklist view.
export function checklistAppliesToSpecies(appliesTo, species) {
  return appliesTo === 'both' || (appliesTo || 'dog') === (species || 'dog');
}
