# Pet Travel Requirements knowledge system

This release turns repeated trip research into a reviewed, reusable knowledge layer without allowing AI output to publish itself.

## Publication states

- `draft`: private research or demand-created candidate.
- `source_verified`: an official source was opened, scoped and dated.
- `editorial_reviewed`: the rule and its plain-language presentation were checked.
- `published`: eligible for the public API and a public destination guide.
- `needs_review`, `stale`, `withdrawn`: not eligible for public delivery.

The public API requires both a `published` requirement and a `source_verified` source. New candidates are always `draft` and `noindex`. No public browser endpoint can write to the knowledge tables.

## Source ownership

- Government authorities support entry, export, transit, quarantine, health, vaccination, treatment, permit and customs requirements.
- Airlines support only their own carriage and service-animal processes.
- Airports support only airport logistics.
- Fees are stored only when an official source publishes an exact amount. The amount, currency, basis and source date travel together. There is no estimated-cost or trip-total feature.

## Demand and privacy

Authenticated checklist requests increment an atomic aggregate of origin country, destination country, species and transportation mode. The demand table does not receive a user ID, pet ID, city, airline, flight number or travel date. A new route can create a private candidate, but publication still requires source and editorial review.

## Solo-maintainer review

YourPetPass uses the owner-approved solo-maintainer exception when an independent reviewer is unavailable. A production release still requires documented source review, automated tests and audits, an exact deployed commit, database security checks, and live flow verification. The reviewer field records that exception rather than implying an independent review occurred.

## Initial cohort

Canada and France are the first structured destinations because reviewed public guides already exist. Their structured records are scoped to United States-origin dogs and cats and link current official government sources. A country label is never treated as a universal rule for every origin, species or movement category.

