# YourPetPass Platform Update Roadmap

Phases One through Seven are complete.

## Phase One — Expanded trip intake + pet travel method

- Expanded itinerary details and per-leg airport, airline, flight, and date fields
- Separate per-pet air-travel arrangement with conditional cabin, checked-pet, and manifest-cargo details
- Backward-compatible Supabase persistence
- Arrangement-aware checklist generation and cache isolation
- Form, persistence, generator-input, compatibility, build, deployment, and production verification

## Phase Two — Airport Guides (complete)

- Reusable guide for every departure, layover, and arrival airport
- Role-specific pet relief, check-in/cargo, security, customs, veterinary inspection, service-animal, hours, and emergency-vet information
- Official airport/government sources and last-verified date

## Phase Three — Timeline-based tasks (complete)

- Eleven travel-planning windows from Start now through After arrival
- Hidden empty sections and backward-compatible placement of existing tasks
- Responsible party, document, source verification, status, dependencies, pet/species, segment, and travel-method scope
- Correct vertical formatting for numbered instructions

## Phase Four — Progress + What’s Missing? (complete)

- Weighted readiness with critical and supporting requirements
- Missing, uploaded awaiting review, needs correction, complete, not applicable, blocked, and expired states
- Critical gaps, upcoming deadlines, and document issues in one actionable view

## Phase Five — Official sources + verification (complete)

- Government sources for country entry, export, transit, quarantine, health, and customs rules
- Airline sources only for airline policy; airport sources only for airport logistics
- Jurisdiction, requirement type, route/species/travel scopes, effective and expiration dates
- Last checked, change detection, and human review status

## Phase Six — Printable/shareable Travel Summary (complete)

- Mobile-friendly trip summary with itinerary, flights, travel method, pets, microchip and service status
- Health-document, permit, lab, requirement-status, and emergency-contact overview
- Branded print view that can be saved as a PDF
- Owner-controlled, expiring, read-only secure link with QR code and immediate revocation
- Uploaded document files remain private; shared views expose only summary metadata

## Phase Seven — Packing checklist + emergency section (complete)

- Packing categories for documents, food and water, medication, carrier or kennel, restraint, comfort, cleaning, arrival, and emergencies
- Adaptive cabin, checked-pet, manifest-cargo, service-animal, land, sea, and bus items
- Saved packing progress on every trip
- Airport-specific emergency-veterinarian details supported by official airport sources when available
- Airline, cargo, government, customs-broker, consignee, and receiving-party contacts from the trip
- Lost-document and missed-connection guidance tailored to the pet's travel arrangement

Product rules: no estimated-cost feature; government sources support country requirements, airline sources support airline policy, and airport sources support airport logistics.

## Follow-up travel support release

- Exact official fees with currency, basis, source, source date, and last-checked date; no estimates or trip totals
- Focused airport conveniences: arrival guidance, official maps, pet water availability, and terminal-change notes
- Structured pet-travel contacts for emergency vets, poison control, airline handling, cargo, government inspection, customs, and verified local pet transport
- Clear airport source coverage states instead of a subjective confidence score
- Travel Summary references for airline confirmation, pet customs/inspection, destination veterinarian, and official fees
- U.S.-focused service-animal document workflow using current DOT and airline submission links
- Deliberately excludes difficulty scoring, accommodation planning, general immigration planning, restaurant listings, and estimated trip costs

## Post-audit implementation program

The sequenced remediation, operational-hardening, rule-maintenance, and next-product plan is maintained in [`docs/POST_AUDIT_IMPLEMENTATION_PLAN.md`](docs/POST_AUDIT_IMPLEMENTATION_PLAN.md).
