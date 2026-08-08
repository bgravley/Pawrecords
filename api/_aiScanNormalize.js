export function normalizeScanExtraction(extracted) {
  if (!extracted || extracted.documentType !== 'vaccine_record') return extracted

  const record = extracted.vaccineRecord || {}
  const existingVisit = extracted.vetVisit || {}
  const vaccines = (record.vaccines?.length ? record.vaccines : existingVisit.vaccines) || []
  const firstGivenDate = vaccines.find((vaccine) => vaccine?.dateGiven)?.dateGiven || null

  return {
    ...extracted,
    vetVisit: {
      visitDate: record.recordDate || existingVisit.visitDate || firstGivenDate,
      vetName: record.vetName || existingVisit.vetName || null,
      clinicName: record.clinicName || existingVisit.clinicName || null,
      reason: existingVisit.reason || 'Vaccination record',
      diagnosis: existingVisit.diagnosis || null,
      treatment: existingVisit.treatment || null,
      weight: existingVisit.weight ?? null,
      cost: existingVisit.cost ?? null,
      notes: existingVisit.notes || null,
      vaccines,
      medications: existingVisit.medications || [],
      allergies: existingVisit.allergies || [],
    },
  }
}

export function hasVaccineDetails(extracted) {
  return (extracted?.vetVisit?.vaccines || []).some((vaccine) => vaccine?.name)
}
