# Official-source research packet — first review cohort

**Status:** research fixture only. Not production data. Not approved for publication.
**Reviewed:** 2026-09-19
**Editorial owner:** YourPetPass Travel Desk

This packet captures primary-source findings for normalization and editorial review. It intentionally avoids converting every source sentence into a rule until scope/origin conditions are modeled.

## 1. United States — import/re-entry

### Primary authorities
- CDC dog import program: https://www.cdc.gov/importation/dogs/
- CDC Dog Import Form instructions: https://www.cdc.gov/importation/dogs/dog-import-form-instructions.html
- CDC high-risk country list: https://www.cdc.gov/importation/dogs/high-risk-countries.html
- USDA APHIS pet dog import: https://www.aphis.usda.gov/pet-travel/another-country-to-us-import/dogs
- USDA APHIS pet cat import: https://www.aphis.usda.gov/pet-travel/another-country-to-us-import/cats

### Normalization findings
- Dog rules must branch on whether the dog has been in a CDC high-risk dog-rabies country during the prior 6 months.
- CDC is the primary federal authority for dog import/re-entry.
- A CDC Dog Import Form receipt is required for each dog. For dogs that have only been in rabies-free/low-risk countries in the prior 6 months, CDC says this is the only CDC form needed.
- U.S.-vaccinated dogs that have been in a high-risk country during the prior 6 months need additional documentation, including the Certification of U.S.-Issued Rabies Vaccination completed before departure from the United States.
- APHIS may add disease-specific requirements, including for origins affected by screwworm or foot-and-mouth disease.
- APHIS Veterinary Services states it has no animal-health import requirements for domestic pet cats, but other federal and state/territory rules may apply.
- Destination state/territory requirements must remain a separate layer from federal entry rules.

### Page-design implication
The U.S. page cannot present one flat dog checklist. It needs a high-risk-country decision branch and a dog/cat branch.

## 2. European Union / France and other EU destinations

### Primary authority
- European Commission, non-commercial pet entry from non-EU countries:
  https://food.ec.europa.eu/animals/live-animal-movements/dogs-cats-and-ferrets/bringing-pet-eu-non-eu-country_en
- European Commission, travel within EU:
  https://food.ec.europa.eu/animals/live-animal-movements/dogs-cats-and-ferrets/travelling-pet-within-eu_en
- European Commission, listed non-EU countries:
  https://food.ec.europa.eu/animals/live-animal-movements/dogs-cats-and-ferrets/listing-territories-and-non-eu-countries_en
- European Commission, travellers' points of entry:
  https://food.ec.europa.eu/animals/live-animal-movements/dogs-cats-and-ferrets/travellers-points-entry_en

### Normalization findings
- Shared EU-level rules should be modeled once and inherited by France/Germany/Italy/Spain/Portugal/Netherlands unless national rules differ.
- Non-commercial movement applies to dogs, cats and ferrets and is generally limited to 5 animals, subject to specified exceptions.
- Identification is generally by compliant microchip.
- Entry from a non-EU country generally requires an animal health certificate and owner/authorized-person declaration, subject to passport exceptions.
- The Commission states the animal health certificate is generally valid for 10 days from issue until documentary/identity checks at the EU point of entry, with a sea-journey extension.
- Rabies antibody titration depends on origin classification; listed third countries can be exempt.
- Most pets entering from non-EU countries must use a designated travellers' point of entry, subject to specified exceptions.
- Owner/pet timing matters: authorized-person movement can remain non-commercial when the owner travels within the specified 5-day window.
- New 2026 EU rules mean old copied guidance must not be assumed current; transitional document provisions need explicit modeling.

### Page-design implication
Destination pages should ask/know origin category. France should not duplicate EU-wide rules as independent prose facts; it should inherit shared verified EU rules plus France-specific overrides/entry logistics.

## 3. Great Britain (England, Wales, Scotland)

### Primary authority
- GOV.UK overview: https://www.gov.uk/bring-pet-to-great-britain
- Pet travel documents: https://www.gov.uk/bring-pet-to-great-britain/which-pet-travel-document
- GB pet health certificate: https://www.gov.uk/bring-pet-to-great-britain/great-britain-pet-health-certificate
- Travel routes: https://www.gov.uk/bring-pet-to-great-britain/travel-routes-pets
- Guide/assistance dogs: https://www.gov.uk/bring-pet-to-great-britain/guide-dogs

### Normalization findings
- Rules differ by origin; Great Britain is not interchangeable with Northern Ireland.
- Dogs, cats and ferrets generally need compliant identification and rabies preparation.
- GOV.UK says the pet must be microchipped before the rabies vaccination used for travel.
- After a first rabies vaccination/primary course, GOV.UK states the wait is at least 21 full days.
- Dogs may require tapeworm treatment 24 hours to 5 days before arrival.
- Required travel document depends on origin.
- A Great Britain pet health certificate can be used from any country and GOV.UK states the pet must enter Great Britain within 10 days of its issue.
- Approved route/company rules matter; air-arriving pets generally travel as cargo unless an exception applies.
- Recognised guide/assistance dogs can use additional routes/forms of transport, but GOV.UK states they still must meet normal dog pet-travel health rules.
- Noncompliance can lead to quarantine or refusal/return, depending on circumstances.

### Page-design implication
The GB page needs origin-dependent document logic, a dog tapeworm timing module, approved-route guidance, and a clearly separated assistance-dog transport section that does not imply exemption from health-entry rules.

## Review cautions

1. These are research findings, not final consumer copy.
2. Before normalization, each rule needs exact species/origin/jurisdiction scope.
3. Transitional 2026 EU rules require special attention because older source copies may now be stale.
4. Airline policies must not be used as legal-entry authority.
5. U.S. state/territory rules must not be collapsed into federal rules.
6. Great Britain and Northern Ireland must remain separate regulatory destinations.
7. No page should be indexable until the final normalized rules and direct-answer copy receive source + editorial review.
