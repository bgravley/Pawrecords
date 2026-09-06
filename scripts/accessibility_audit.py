#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
failures = []
passes = []


def read(path):
    return (ROOT / path).read_text(encoding='utf-8', errors='ignore')


def check(ok, message):
    (passes if ok else failures).append(message)


paw = read('src/PawRecord.jsx')
travel = read('src/Travel.jsx')
smoke = read('scripts/live_smoke.mjs')

# Keyboard/focus foundation.
check('button:focus-visible,[role="button"]:focus-visible' in paw, 'Keyboard focus is visibly indicated on buttons and interactive cards')
check('aria-hidden="true" focusable="false"' in paw, 'Decorative SVG icons are hidden from assistive technology')
check('disabled={!!disabled}' in paw and 'aria-disabled={disabled?true:undefined}' in paw, 'PawRecord buttons expose real disabled state')
check('disabled={!!disabled}' in travel and 'aria-disabled={disabled ? true : undefined}' in travel, 'Travel buttons expose real disabled state')
check('role={onClick?"button":undefined}' in paw and 'tabIndex={onClick?0:undefined}' in paw and 'e.key==="Enter"' in paw and 'e.key===" "' in paw, 'Clickable PawRecord cards support keyboard activation')
check('role={onClick ? "button" : undefined}' in travel and 'tabIndex={onClick ? 0 : undefined}' in travel and 'e.key === "Enter"' in travel and 'e.key === " "' in travel, 'Clickable Travel cards support keyboard activation')
check('aria-label="YourPetPass home"' in paw, 'Home logo button has an explicit accessible name')

# Forms/dialogs.
check('const Field=({label,children,col})=>(\n  <label' in paw, 'PawRecord Field wraps its form control with its visible label')
check('const Field = ({ label, children, col }) => (\n  <label' in travel, 'Travel Field wraps its form control with its visible label')
check('role="dialog" aria-modal="true" aria-label={title}' in paw and 'aria-label={`Close ${title}`}' in paw, 'PawRecord modals expose dialog name and labeled close button')
check('role="dialog" aria-modal="true" aria-label={title}' in travel and 'aria-label={`Close ${title}`}' in travel, 'Travel modals expose dialog name and labeled close button')
check('aria-label="Search vaccinations"' in paw, 'Vaccination search has an accessible name')
check('aria-label="Search vet visits"' in paw, 'Vet-visit search has an accessible name')

# Known icon-only record controls.
for needle, label in [
    ('aria-label={`Edit ${v.name} vaccination`}', 'vaccination edit'),
    ('aria-label={`Delete ${v.name} vaccination`}', 'vaccination delete'),
    ('aria-label={`Edit ${a.allergen} allergy`}', 'allergy edit'),
    ('aria-label={`Delete ${a.allergen} allergy`}', 'allergy delete'),
    ('aria-label={`Edit ${m.name} medication`}', 'medication edit'),
    ('aria-label={`Delete ${m.name} medication`}', 'medication delete'),
    ('aria-label={`Delete weight record from ${fmt(w.log_date)}`}', 'weight delete'),
    ('aria-label={`Delete saved vet ${v.name}`}', 'saved-vet delete'),
    ('aria-label={`Open ${d.name||"document"}`}', 'document open'),
    ('aria-label={`Delete ${d.name||"document"}`}', 'document delete'),
    ('aria-label={`Delete emergency contact ${ec.name}`}', 'emergency-contact delete'),
]:
    check(needle in paw, f'Icon-only {label} control has an accessible name')

# Empty states must explain what happens next, not leave blank screens/dead click text.
check('<section aria-label={title}' in paw and '<h3' in paw, 'Shared health-record empty states use semantic region and heading')
check('title="No allergies recorded"' in paw and 'Add Allergy' in paw, 'Allergy empty state has a clear next action')
check('title="No documents yet"' in paw and 'Scan First Document' in paw, 'Documents empty state explains and offers the first action')
check('title="No saved vets yet"' in paw and 'Save a Vet' in paw, 'Saved-vets empty state no longer renders a blank list')
check('<h2 style={{fontFamily:"\'Lora\',serif",fontSize:28' in paw and '>Welcome to YourPetPass</h2>' in paw, 'First-run My Pets state has a real heading')
check('<section aria-label={filter === "upcoming" ? "No upcoming trips" : "No past trips"}' in travel and '+ Plan First Trip' in travel, 'Travel empty state is semantic and actionable')

# The production smoke must eventually enforce browser-rendered names/labels too.
check('assertAccessibleControls' in smoke, 'Production smoke checks rendered accessible names and form labels')

print('\nYourPetPass accessibility + empty-state audit')
print('=' * 48)
for item in passes:
    print(f'PASS  {item}')
if failures:
    print('\nFAILURES')
    for item in failures:
        print(f'FAIL  {item}')
    raise SystemExit(1)
print(f'\nAll {len(passes)} accessibility and empty-state checks passed.')
