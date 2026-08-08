import test from 'node:test'
import assert from 'node:assert/strict'
import { hasVaccineDetails, normalizeScanExtraction } from './_aiScanNormalize.js'

test('normalizes a standalone vaccine record into the existing save shape', () => {
  const extracted = normalizeScanExtraction({
    documentType: 'vaccine_record',
    documentSummary: 'Pet vaccination booklet',
    vetVisit: null,
    vaccineRecord: {
      recordDate: '2026-07-11',
      petName: 'Sadie',
      vetName: 'Paula Garcia',
      clinicName: 'Salud Pet SOS',
      vaccines: [
        { name: 'DHPP', dateGiven: '2026-07-11', nextDue: '2029-07-11', lotNumber: '46838', type: 'core' },
        { name: 'Leptospirosis', dateGiven: '2026-07-11', nextDue: '2027-07-11', lotNumber: '320403', type: 'optional' },
      ],
    },
  })

  assert.equal(extracted.vetVisit.visitDate, '2026-07-11')
  assert.equal(extracted.vetVisit.vetName, 'Paula Garcia')
  assert.equal(extracted.vetVisit.vaccines.length, 2)
  assert.equal(hasVaccineDetails(extracted), true)
})

test('keeps legacy vaccine responses that populated vetVisit', () => {
  const extracted = normalizeScanExtraction({
    documentType: 'vaccine_record',
    vetVisit: { visitDate: '2026-07-11', vaccines: [{ name: 'Rabies' }] },
  })
  assert.equal(extracted.vetVisit.vaccines[0].name, 'Rabies')
})

test('detects an identified vaccine document with no usable vaccine data', () => {
  const extracted = normalizeScanExtraction({
    documentType: 'vaccine_record',
    vaccineRecord: { vaccines: [] },
  })
  assert.equal(hasVaccineDetails(extracted), false)
})
