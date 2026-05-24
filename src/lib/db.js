// src/lib/db.js
// All Supabase database operations for PawRecord
import { supabase } from './supabase'

// ── DOGS ──────────────────────────────────────────────────
export const getDogs = async (userId) => {
  const { data, error } = await supabase
    .from('dogs').select('*').eq('user_id', userId).order('created_at')
  return { data: data || [], error }
}
export const addDog = async (userId, dog) => {
  const { data, error } = await supabase.from('dogs').insert({
    user_id: userId, name: dog.name, breed: dog.breed, dob: dog.dob || null,
    weight: dog.weight || null, gender: dog.gender, neutered: dog.neutered,
    microchip: dog.microchip, color: dog.color, emergency_contact: dog.emergencyContact,
    emergency_phone: dog.emergencyPhone, notes: dog.notes,
  }).select().single()
  return { data, error }
}
export const updateDog = async (dog) => {
  const { data, error } = await supabase.from('dogs').update({
    name: dog.name, breed: dog.breed, dob: dog.dob || null,
    weight: dog.weight || null, gender: dog.gender, neutered: dog.neutered,
    microchip: dog.microchip, color: dog.color, emergency_contact: dog.emergencyContact,
    emergency_phone: dog.emergencyPhone, notes: dog.notes,
  }).eq('id', dog.id).select().single()
  return { data, error }
}
export const deleteDog = async (id) => supabase.from('dogs').delete().eq('id', id)

// ── DOG PHOTO UPLOAD ──────────────────────────────────────
export const uploadDogPhoto = async (userId, dogId, file) => {
  const ext = file.name.split('.').pop()
  const path = `${userId}/dogs/${dogId}.${ext}`
  const { error: upErr } = await supabase.storage.from('documents').upload(path, file, { upsert: true })
  if (upErr) return { url: null, error: upErr }
  const { data } = supabase.storage.from('documents').getPublicUrl(path)
  return { url: data.publicUrl, error: null }
}

// ── VACCINATIONS ──────────────────────────────────────────
export const getVaccinations = async (userId) => {
  const { data, error } = await supabase
    .from('vaccinations').select('*').eq('user_id', userId).order('date_given', { ascending: false })
  return { data: data || [], error }
}
export const addVaccination = async (userId, v) => {
  const { data, error } = await supabase.from('vaccinations').insert({
    dog_id: v.dogId, user_id: userId, name: v.name, type: v.type,
    date_given: v.dateGiven || null, next_due: v.nextDue || null,
    duration_months: v.durationMonths, lot_number: v.lotNumber, vet_name: v.vetName, notes: v.notes,
  }).select().single()
  return { data, error }
}
export const updateVaccination = async (v) => {
  const { data, error } = await supabase.from('vaccinations').update({
    name: v.name, type: v.type, date_given: v.dateGiven || null, next_due: v.nextDue || null,
    duration_months: v.durationMonths, lot_number: v.lotNumber, vet_name: v.vetName, notes: v.notes,
  }).eq('id', v.id).select().single()
  return { data, error }
}
export const deleteVaccination = async (id) => supabase.from('vaccinations').delete().eq('id', id)

// ── MEDICATIONS ───────────────────────────────────────────
export const getMedications = async (userId) => {
  const { data, error } = await supabase
    .from('medications').select('*').eq('user_id', userId).order('created_at')
  return { data: data || [], error }
}
export const addMedication = async (userId, m) => {
  const { data, error } = await supabase.from('medications').insert({
    dog_id: m.dogId, user_id: userId, name: m.name, dosage: m.dosage,
    frequency: m.frequency, start_date: m.startDate || null, end_date: m.endDate || null,
    prescribing_vet: m.prescribingVet, reason: m.reason, notes: m.notes, active: m.active,
  }).select().single()
  return { data, error }
}
export const updateMedication = async (m) => {
  const { data, error } = await supabase.from('medications').update({
    name: m.name, dosage: m.dosage, frequency: m.frequency, start_date: m.startDate || null,
    end_date: m.endDate || null, prescribing_vet: m.prescribingVet, reason: m.reason,
    notes: m.notes, active: m.active,
  }).eq('id', m.id).select().single()
  return { data, error }
}
export const deleteMedication = async (id) => supabase.from('medications').delete().eq('id', id)

// ── ALLERGIES ─────────────────────────────────────────────
export const getAllergies = async (userId) => {
  const { data, error } = await supabase
    .from('allergies').select('*').eq('user_id', userId).order('created_at')
  return { data: data || [], error }
}
export const addAllergy = async (userId, a) => {
  const { data, error } = await supabase.from('allergies').insert({
    dog_id: a.dogId, user_id: userId, allergen: a.allergen, reaction: a.reaction,
    severity: a.severity, date_discovered: a.dateDiscovered || null, notes: a.notes,
  }).select().single()
  return { data, error }
}
export const updateAllergy = async (a) => {
  const { data, error } = await supabase.from('allergies').update({
    allergen: a.allergen, reaction: a.reaction, severity: a.severity,
    date_discovered: a.dateDiscovered || null, notes: a.notes,
  }).eq('id', a.id).select().single()
  return { data, error }
}
export const deleteAllergy = async (id) => supabase.from('allergies').delete().eq('id', id)

// ── VET VISITS ────────────────────────────────────────────
export const getVisits = async (userId) => {
  const { data, error } = await supabase
    .from('vet_visits').select('*').eq('user_id', userId).order('visit_date', { ascending: false })
  return { data: data || [], error }
}
export const addVisit = async (userId, v) => {
  const { data, error } = await supabase.from('vet_visits').insert({
    dog_id: v.dogId, user_id: userId, visit_date: v.date, vet_name: v.vetName,
    clinic: v.clinic, reason: v.reason, diagnosis: v.diagnosis,
    treatment: v.treatment, cost: v.cost || null, notes: v.notes,
  }).select().single()
  return { data, error }
}
export const updateVisit = async (v) => {
  const { data, error } = await supabase.from('vet_visits').update({
    visit_date: v.date, vet_name: v.vetName, clinic: v.clinic, reason: v.reason,
    diagnosis: v.diagnosis, treatment: v.treatment, cost: v.cost || null, notes: v.notes,
  }).eq('id', v.id).select().single()
  return { data, error }
}
export const deleteVisit = async (id) => supabase.from('vet_visits').delete().eq('id', id)

// ── WEIGHTS ───────────────────────────────────────────────
export const getWeights = async (userId) => {
  const { data, error } = await supabase
    .from('weights').select('*').eq('user_id', userId).order('log_date')
  return { data: data || [], error }
}
export const addWeight = async (userId, w) => {
  const { data, error } = await supabase.from('weights').insert({
    dog_id: w.dogId, user_id: userId, log_date: w.date, weight_lbs: w.weight, notes: w.notes,
  }).select().single()
  return { data, error }
}
export const deleteWeight = async (id) => supabase.from('weights').delete().eq('id', id)

// ── SAVED VETS ────────────────────────────────────────────
export const getSavedVets = async (userId) => {
  const { data, error } = await supabase
    .from('saved_vets').select('*').eq('user_id', userId).order('name')
  return { data: data || [], error }
}
export const addSavedVet = async (userId, v) => {
  const { data, error } = await supabase.from('saved_vets').insert({
    user_id: userId, name: v.name, clinic: v.clinic, phone: v.phone,
    email: v.email, address: v.address, notes: v.notes,
  }).select().single()
  return { data, error }
}
export const updateSavedVet = async (v) => {
  const { data, error } = await supabase.from('saved_vets').update({
    name: v.name, clinic: v.clinic, phone: v.phone, email: v.email,
    address: v.address, notes: v.notes,
  }).eq('id', v.id).select().single()
  return { data, error }
}
export const deleteSavedVet = async (id) => supabase.from('saved_vets').delete().eq('id', id)

// ── DOCUMENTS ─────────────────────────────────────────────
export const getDocuments = async (userId) => {
  const { data, error } = await supabase
    .from('documents').select('*').eq('user_id', userId).order('doc_date', { ascending: false })
  return { data: data || [], error }
}
export const addDocument = async (userId, userId2, doc, file) => {
  let filePath = null
  if (file) {
    const ext = file.name?.split('.').pop() || 'jpg'
    filePath = `${userId}/docs/${doc.id}.${ext}`
    await supabase.storage.from('documents').upload(filePath, file, { upsert: true })
  }
  const { data, error } = await supabase.from('documents').insert({
    dog_id: doc.dogId, user_id: userId, name: doc.name, doc_date: doc.date || null,
    doc_type: doc.type, notes: doc.notes, file_path: filePath,
  }).select().single()
  return { data, error }
}
export const getDocumentUrl = async (filePath) => {
  const { data } = await supabase.storage.from('documents').createSignedUrl(filePath, 3600)
  return data?.signedUrl || null
}
export const deleteDocument = async (id, filePath) => {
  if (filePath) await supabase.storage.from('documents').remove([filePath])
  return supabase.from('documents').delete().eq('id', id)
}

// ── PROFILE ───────────────────────────────────────────────
export const getProfile = async (userId) => {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
  return { data, error }
}
export const updateProfile = async (userId, updates) => {
  const { data, error } = await supabase.from('profiles').update(updates).eq('id', userId).select().single()
  return { data, error }
}
