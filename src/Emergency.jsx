// src/Emergency.jsx — token-scoped public emergency pet record
// No direct anonymous database access. The server validates the QR token and
// returns only the fields intentionally exposed on an emergency card.
import { useEffect, useState } from 'react'

const C = {
  forest: '#2C4A38',
  sage: '#7C9E87',
  lightSage: '#9DC4AA',
  mint: '#EAF4EE',
  warm: '#FAFCFB',
  gold: '#C9A84C',
  text: '#1A2E22',
  danger: '#A4483E',
  line: '#DCE8E0',
}

const fmt = (d) => {
  if (!d) return '—'
  return new Date(`${d}T12:00:00`).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

const ageFromDob = (dob) => {
  if (!dob) return null
  const born = new Date(`${dob}T12:00:00`)
  if (Number.isNaN(born.getTime())) return null
  return Math.max(0, Math.floor((Date.now() - born.getTime()) / (365.25 * 86400000)))
}

const vaccineStatus = (due) => {
  if (!due) return { label: 'No due date', color: C.sage }
  const days = Math.round((new Date(`${due}T12:00:00`) - new Date()) / 86400000)
  if (days < 0) return { label: `Overdue ${Math.abs(days)}d`, color: C.danger }
  if (days <= 30) return { label: `Due in ${days}d`, color: C.gold }
  return { label: 'Current', color: C.forest }
}

const Section = ({ title, children, danger = false }) => (
  <section style={{
    background: '#fff',
    border: `1px solid ${danger ? '#E7C7C3' : C.line}`,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    boxShadow: '0 2px 10px rgba(26,46,34,.05)',
  }}>
    <h2 style={{
      margin: '0 0 14px',
      fontFamily: "'Playfair Display', serif",
      fontSize: 20,
      color: danger ? C.danger : C.forest,
    }}>{title}</h2>
    {children}
  </section>
)

const InfoRow = ({ label, value }) => value ? (
  <div style={{
    display: 'flex', justifyContent: 'space-between', gap: 16,
    padding: '9px 0', borderBottom: `1px solid ${C.line}`,
  }}>
    <span style={{ color: C.sage, fontWeight: 600 }}>{label}</span>
    <span style={{ color: C.text, textAlign: 'right' }}>{value}</span>
  </div>
) : null

export default function Emergency({ token }) {
  const [record, setRecord] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setNotFound(false)
      try {
        if (!token) throw new Error('missing-token')
        const response = await fetch(`/api/emergency-record?token=${encodeURIComponent(token)}`, {
          headers: { Accept: 'application/json' },
          cache: 'no-store',
        })
        if (response.status === 404) throw new Error('not-found')
        if (!response.ok) throw new Error('unavailable')
        const data = await response.json()
        if (!cancelled) setRecord(data)
      } catch (error) {
        if (!cancelled) setNotFound(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [token])

  const shell = (children) => (
    <div style={{ minHeight: '100vh', background: C.warm, color: C.text, fontFamily: "'Lora', serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Lora:wght@400;600&family=Playfair+Display:wght@700;800&display=swap');*{box-sizing:border-box}body{margin:0}`}</style>
      {children}
    </div>
  )

  if (loading) return shell(
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 44, marginBottom: 12 }}>🐾</div>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, color: C.forest }}>Loading emergency record…</div>
      </div>
    </div>
  )

  if (notFound || !record?.pet) return shell(
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div style={{ maxWidth: 440, textAlign: 'center' }}>
        <div style={{ fontSize: 46, marginBottom: 12 }}>🐾</div>
        <h1 style={{ fontFamily: "'Playfair Display', serif", color: C.forest, marginBottom: 10 }}>Record Not Found</h1>
        <p style={{ lineHeight: 1.7, color: C.sage }}>This QR code may be invalid or may have been regenerated. Please contact the pet's owner.</p>
        <a href="/" style={{ color: C.forest, fontWeight: 700 }}>YourPetPass.com</a>
      </div>
    </div>
  )

  const { pet, allergies = [], medications = [], vaccinations = [] } = record
  const age = ageFromDob(pet.dob)
  const classification = pet.pet_type === 'service_animal'
    ? 'Service Animal'
    : pet.pet_type === 'esa'
      ? 'Emotional Support Animal'
      : null
  const species = pet.species ? pet.species.charAt(0).toUpperCase() + pet.species.slice(1) : null
  const callNumber = `${pet.emergency_phone_code || ''}${pet.emergency_phone || ''}`.replace(/[^+\d]/g, '')
  const whatsappNumber = `${pet.emergency_whatsapp_code || ''}${pet.emergency_whatsapp || ''}`.replace(/\D/g, '')

  return shell(
    <>
      <header style={{ background: C.forest, color: '#fff', padding: '26px 20px 30px' }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <div style={{ color: C.lightSage, fontSize: 12, textTransform: 'uppercase', letterSpacing: '.12em', fontWeight: 600 }}>YourPetPass Emergency Health Card</div>
          <h1 style={{ margin: '7px 0 5px', fontFamily: "'Playfair Display', serif", fontSize: 34 }}>{pet.name}</h1>
          <div style={{ color: '#DDE9E1' }}>{[species, pet.breed, age !== null ? `${age} years old` : null].filter(Boolean).join(' · ')}</div>
          {classification && (
            <div style={{ display: 'inline-block', marginTop: 12, padding: '6px 11px', border: `1px solid ${C.gold}`, borderRadius: 999, color: '#fff', fontSize: 13 }}>
              {classification}
            </div>
          )}
        </div>
      </header>

      <main style={{ maxWidth: 640, margin: '0 auto', padding: '20px 16px 44px' }}>
        {(allergies.length > 0) && (
          <Section title="Known Allergies" danger>
            {allergies.map((a, i) => (
              <div key={`${a.allergen}-${i}`} style={{ padding: '9px 0', borderBottom: `1px solid ${C.line}` }}>
                <div style={{ fontWeight: 700 }}>{a.allergen}</div>
                <div style={{ fontSize: 13, marginTop: 3, color: C.sage }}>
                  {[a.reaction, a.severity].filter(Boolean).join(' · ')}
                </div>
              </div>
            ))}
          </Section>
        )}

        {(pet.emergency_contact || callNumber || whatsappNumber) && (
          <Section title="Emergency Contact">
            {pet.emergency_contact && <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 12 }}>{pet.emergency_contact}</div>}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {callNumber && (
                <a href={`tel:${callNumber}`} style={{ background: C.forest, color: '#fff', padding: '10px 15px', borderRadius: 10, textDecoration: 'none', fontWeight: 700 }}>Call</a>
              )}
              {whatsappNumber && (
                <a href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noopener noreferrer" style={{ background: C.mint, color: C.forest, border: `1px solid ${C.lightSage}`, padding: '10px 15px', borderRadius: 10, textDecoration: 'none', fontWeight: 700 }}>WhatsApp</a>
              )}
            </div>
          </Section>
        )}

        <Section title="Pet Profile">
          <InfoRow label="Name" value={pet.name} />
          <InfoRow label="Species" value={species} />
          <InfoRow label="Breed" value={pet.breed} />
          <InfoRow label="Date of birth" value={pet.dob ? fmt(pet.dob) : null} />
          <InfoRow label="Weight" value={pet.weight ? `${pet.weight} lbs` : null} />
          <InfoRow label="Color" value={pet.color} />
          <InfoRow label="Sex" value={pet.gender ? `${pet.gender}${pet.neutered ? ' · Spayed/Neutered' : ''}` : null} />
          <InfoRow label="Microchip" value={pet.microchip} />
          <InfoRow label="Classification" value={classification} />
        </Section>

        {medications.length > 0 && (
          <Section title="Active Medications">
            {medications.map((m, i) => (
              <div key={`${m.name}-${i}`} style={{ padding: '9px 0', borderBottom: `1px solid ${C.line}` }}>
                <div style={{ fontWeight: 700 }}>{m.name}</div>
                <div style={{ fontSize: 13, color: C.sage, marginTop: 3 }}>{[m.dosage, m.frequency, m.reason].filter(Boolean).join(' · ')}</div>
              </div>
            ))}
          </Section>
        )}

        {vaccinations.length > 0 && (
          <Section title="Vaccinations">
            {vaccinations.map((v, i) => {
              const status = vaccineStatus(v.next_due)
              return (
                <div key={`${v.name}-${v.date_given}-${i}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 14, padding: '10px 0', borderBottom: `1px solid ${C.line}` }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{v.name}</div>
                    <div style={{ fontSize: 12, color: C.sage, marginTop: 3 }}>{v.date_given ? `Given ${fmt(v.date_given)}` : 'Date not recorded'}{v.vet_name ? ` · ${v.vet_name}` : ''}</div>
                  </div>
                  <div style={{ color: status.color, fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap' }}>{status.label}</div>
                </div>
              )
            })}
          </Section>
        )}

        <div style={{ textAlign: 'center', color: C.sage, fontSize: 12, lineHeight: 1.6, paddingTop: 8 }}>
          Emergency information shared by the pet's owner through YourPetPass.<br />
          Generated {new Date(record.generated_at || Date.now()).toLocaleString()}.
        </div>
      </main>
    </>
  )
}
