# Pet Travel Requirements — Review Architecture

Status: **design/review only**. Nothing in this document authorizes production deployment or publication.

Tracking issue: #131

## Release gate

This work must remain isolated from production until Brandon reviews and explicitly approves it.

- Develop on a feature branch.
- Use draft pull requests for review.
- Do not merge to main as part of implementation work.
- Do not deploy to the production YourPetPass project.
- Do not publish/index generated country or route pages before review.
- Draft/unreviewed public-page candidates must be noindex if they are ever rendered in a preview environment.
- Database design should begin as migrations/code for review; do not apply production migrations without explicit approval.

## Architecture principle

Research once → normalize once → verify once → reuse across:
- Trip Planner
- public destination requirement guides
- timeline/checklist tools
- editorial guides
- future paperwork-validity tools

The existing official-source AI research flow remains the research engine. The new knowledge layer is not a second independent AI research system.

## Proposed normalized entities

### travel_jurisdictions
Canonical destination/origin jurisdictions and grouping metadata (country, territory, EU-style regulatory group where appropriate).

### travel_sources
Official source URL, authority, source scope, jurisdiction, last checked, effective/expiration dates, review state.

Source scope must enforce:
- government authority → legal entry/export/transit/quarantine/health/vaccination/treatment/permit/customs rules
- airline → carrier policy only
- airport → airport logistics only

### travel_requirements
Atomic verified rules. Proposed fields include:
- jurisdiction
- origin scope/category
- destination scope
- species
- transportation mode
- travel arrangement
- requirement type
- title / normalized description
- timing basis
- timing window/value/unit
- document requirement
- source
- effective/expiration dates
- confidence/review state
- last reviewed

### travel_requirement_versions
Meaningful rule changes, previous/new normalized values, source evidence, effective date, reviewer and change classification.

### travel_guide_candidates
Destination/route publication candidates with status:
draft → source_verified → editorial_reviewed → published
and exceptional states:
needs_review / stale / withdrawn.

### travel_route_demand
Aggregate, non-identifying demand signals: origin, destination, species, mode, request count, first/last requested. Do not duplicate private itinerary details for SEO analytics.

## Public URL model

Primary hub:
`/pet-travel-requirements/`

Default destination authority page:
`/pet-travel-requirements/{destination}/`

Do not create every origin × destination permutation. A route page is justified only when origin-specific law/workflow creates materially different search intent or a distinct compliance path.

## User flow

1. User enters origin, destination, species, travel date and mode.
2. System checks reviewed structured rules.
3. If sufficient reviewed rules exist, build the answer/checklist from them.
4. If not, invoke the existing official-source research workflow.
5. Return the researched trip result to the user.
6. Normalize reusable findings.
7. Record aggregate route demand.
8. Create/update a publication candidate.
9. Require source + editorial QA before public indexing.

## Initial content cohort

Choose the first cohort from existing researched routes, actual demand, regulatory complexity and search usefulness rather than an arbitrary fixed list.

Existing research makes these sensible review candidates:
United States, Canada, Mexico, France, United Kingdom, Germany, Italy, Spain, Portugal/EU, Costa Rica, Brazil, Australia, Japan, Colombia and Ecuador.

Expand toward ~25 only after source review.

## Country guide requirements

Every published guide should include:
- direct answer
- dog/cat distinctions
- relevant origin distinctions
- microchip/rabies/titer/certificate/treatment/permit/quarantine/arrival workflow as applicable
- timing/decision module
- primary official sources
- last-reviewed date
- YourPetPass Travel Desk organizational byline
- canonical www URL
- appropriate WebPage/Article and BreadcrumbList structured data
- internal links to Trip Planner and adjacent guides
- contextual signup CTA
- sitemap/hub inclusion

Never use Brandon Gravley as the public editorial byline.

## Timeline calculator

The calculator should be deterministic. It calculates dates from reviewed structured timing rules and the user's travel date. AI may research a missing rule, but it must not improvise deadline arithmetic or silently substitute generic timing.

## Publication QA

Before a guide becomes indexable:
1. source authority valid for claim type
2. source reachable/current
3. species/origin scope correct
4. timing represented structurally
5. duplicate/cannibalization check
6. material-distinction check for route pages
7. editorial review
8. canonical/schema/sitemap checks
9. mobile + desktop preview
10. audit suite passes

## Metrics

Aggregate only:
- route requests
- reviewed guide hit vs research required
- cached/reused vs new research
- guide → Trip Planner
- guide → signup
- search impressions/clicks/index status when available

## Explicit non-goals for first release

- mass programmatic generation
- auto-publishing AI output
- estimated travel costs
- generic immigration/accommodation content
- thin airline × route pages
- replacing government authority with blogs/aggregators
