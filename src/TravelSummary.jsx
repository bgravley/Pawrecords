import { useEffect, useRef, useState } from 'react';
import { buildTravelSummaryHtml, formatTravelDate, petTravelDetails } from './lib/travelSummary.js';
import { feeLabel, normalizeTravelSupport, serviceAnimalWorkflows, travelSupportReferenceRows } from './lib/travelSupport.js';

const C = { green: '#2C4A38', gold: '#C9A84C', sage: '#7C9E87', cream: '#EAF4EE', white: '#FAFCFB', text: '#1A2E22', border: '#DCE8E0' };
const sectionStyle = { background: '#fff', border: `1px solid ${C.border}`, borderRadius: 16, padding: 18, marginBottom: 14 };

function QrCode({ value }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    if (!value || !canvasRef.current || !window.QRious) return;
    new window.QRious({ element: canvasRef.current, value, size: 180, foreground: C.green, background: '#FFFFFF', level: 'H' });
  }, [value]);
  return <canvas ref={canvasRef} width="180" height="180" aria-label="QR code for this secure travel summary" style={{ width: 180, height: 180, borderRadius: 12, background: '#fff' }} />;
}

function SummarySection({ title, children }) {
  return <section style={sectionStyle}><h2 style={{ fontFamily: "'Playfair Display', serif", color: C.green, fontSize: 20, margin: '0 0 12px' }}>{title}</h2>{children}</section>;
}

export default function TravelSummary({ token }) {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    document.title = 'Secure Travel Summary | YourPetPass';
    const robots = document.createElement('meta');
    robots.name = 'robots'; robots.content = 'noindex,nofollow,noarchive'; document.head.appendChild(robots);
    fetch(`/api/travel-share?token=${encodeURIComponent(token)}`, { headers: { Accept: 'application/json' }, cache: 'no-store' })
      .then(async response => { const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error || 'This summary is not available.'); return body; })
      .then(setSummary).catch(err => setError(err.message));
    return () => robots.remove();
  }, [token]);

  if (error) return <main style={{ minHeight: '100vh', background: C.white, display: 'grid', placeItems: 'center', padding: 24, fontFamily: "'Lora', serif" }}><section style={{ maxWidth: 460, textAlign: 'center' }}><div style={{ fontSize: 38 }}>🐾</div><h1 style={{ fontFamily: "'Playfair Display', serif", color: C.green }}>Travel summary unavailable</h1><p style={{ color: C.sage }}>{error}</p><a href="/" style={{ color: C.green, fontWeight: 700 }}>Go to YourPetPass</a></section></main>;
  if (!summary) return <main style={{ minHeight: '100vh', background: C.white, display: 'grid', placeItems: 'center', color: C.green, fontFamily: "'Lora', serif", fontWeight: 700 }}>🐾 Loading travel summary...</main>;

  const pets = petTravelDetails(summary.trip, summary.pets);
  const support = normalizeTravelSupport(summary.trip.travel_support);
  const supportRows = travelSupportReferenceRows(support);
  const serviceWorkflows = serviceAnimalWorkflows(summary.trip, summary.pets);
  const officialFees = summary.checklist.filter(item => feeLabel(item));
  const shareUrl = window.location.href;
  const print = () => {
    const popup = window.open('', '_blank');
    if (!popup) return;
    popup.document.write(buildTravelSummaryHtml({ ...summary, shareUrl })); popup.document.close(); popup.opener = null; popup.focus();
    setTimeout(() => popup.print(), 250);
  };

  return <main style={{ minHeight: '100vh', background: C.white, color: C.text, fontFamily: "'Lora', serif", paddingBottom: 40 }}>
    <header style={{ background: C.green, color: '#fff', padding: '22px 18px' }}><div style={{ maxWidth: 760, margin: 'auto' }}><div style={{ color: C.gold, fontWeight: 700 }}>🐾 YourPetPass</div><h1 style={{ fontFamily: "'Playfair Display', serif", margin: '8px 0 4px' }}>{summary.trip.name || `${summary.trip.origin_city} to ${summary.trip.destination_city}`}</h1><div style={{ color: C.cream }}>{summary.trip.origin_city}, {summary.trip.origin_country} → {summary.trip.destination_city}, {summary.trip.destination_country}</div></div></header>
    <div style={{ maxWidth: 760, margin: 'auto', padding: 18 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}><button onClick={print} style={{ border: 0, borderRadius: 12, background: C.gold, color: C.text, padding: '11px 16px', fontWeight: 700, cursor: 'pointer' }}>Print / Save PDF</button><a href="/" style={{ border: `1px solid ${C.border}`, borderRadius: 12, color: C.green, padding: '10px 16px', fontWeight: 700, textDecoration: 'none' }}>Open YourPetPass</a></div>
      <SummarySection title="Trip details">Departure: {formatTravelDate(summary.trip.departure_date)}<br />Overall travel: {summary.trip.transportation_type || 'air'}</SummarySection>
      <SummarySection title="Flights & itinerary">{summary.legs.map((leg, index) => <p key={index}><strong>{leg.origin_city}{leg.origin_airport_code ? ` (${leg.origin_airport_code})` : ''} → {leg.destination_city}{leg.destination_airport_code ? ` (${leg.destination_airport_code})` : ''}</strong><br /><span style={{ color: C.sage }}>{formatTravelDate(leg.departure_date)} · {leg.airline || leg.transportation_type} {leg.flight_number || ''}</span></p>)}</SummarySection>
      <SummarySection title="Traveling pets">{pets.map(pet => <div key={pet.id} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: `1px solid ${C.cream}` }}>{pet.photo_url ? <img src={pet.photo_url} alt={pet.name} style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover' }} /> : <div style={{ width: 56, height: 56, borderRadius: '50%', background: C.cream, display: 'grid', placeItems: 'center' }}>🐾</div>}<div><strong>{pet.name}</strong><div style={{ color: C.sage, fontSize: 13 }}>{pet.breed || pet.species || 'Pet'} · {pet.travel_arrangement_label}<br />Microchip: {pet.microchip || 'Not added'}<br />{pet.pet_type === 'service_animal' || pet.is_service_animal ? 'Service animal' : pet.pet_type === 'esa' || pet.is_esa ? 'Emotional support animal' : 'Pet'}{pet.emergency_contact || pet.emergency_phone ? <><br />Emergency: {[pet.emergency_contact, pet.emergency_phone].filter(Boolean).join(' · ')}</> : null}</div></div></div>)}</SummarySection>
      <SummarySection title="Travel references">
        {supportRows.map(([label, value]) => <p key={label}><strong>{label}:</strong> {label === 'Contacts checked' ? formatTravelDate(value) : value}</p>)}
        {Object.values(support.destination_vet).some(Boolean) && <p><strong>Destination veterinarian:</strong> {[support.destination_vet.name, support.destination_vet.clinic, support.destination_vet.phone, support.destination_vet.email].filter(Boolean).join(' · ')}</p>}
        {serviceWorkflows.map(({ pet, details }) => <p key={pet.id}><strong>{pet.name} · U.S. service-animal forms:</strong> DOT {(details.dot_form_status || 'not started').replaceAll('_', ' ')} · Relief {(details.relief_attestation_status || 'not applicable').replaceAll('_', ' ')}</p>)}
        {officialFees.map(item => <p key={item.title}><strong>{item.title}: {feeLabel(item)}</strong>{item.fee_basis ? ` · ${item.fee_basis}` : ''}<br /><span style={{ color: C.sage, fontSize: 12 }}>Checked {formatTravelDate(item.fee_last_checked_at || item.researched_at)} · <a href={item.source_url} target="_blank" rel="noreferrer" style={{ color: C.green }}>Official source</a>. Additional fees may apply.</span></p>)}
        {!supportRows.length && !Object.values(support.destination_vet).some(Boolean) && !serviceWorkflows.length && !officialFees.length && <p>No additional pet-travel references added.</p>}
      </SummarySection>
      <SummarySection title="Documents, permits & labs"><ul>{summary.documents.length ? summary.documents.map((doc, index) => <li key={index}>{doc.name}{doc.doc_date ? ` · ${formatTravelDate(doc.doc_date)}` : ''}</li>) : <li>No travel documents added yet.</li>}</ul></SummarySection>
      <SummarySection title="Requirements"><ul>{summary.checklist.length ? summary.checklist.map((item, index) => <li key={index}><strong>{item.title}</strong> · {(item.readiness_status || (item.is_completed ? 'complete' : 'missing')).replaceAll('_', ' ')}{item.source_url ? <> · <a href={item.source_url} target="_blank" rel="noreferrer" style={{ color: C.green }}>{item.source_authority || 'Official source'}</a></> : ' · Source needed'}</li>) : <li>No requirements added yet.</li>}</ul></SummarySection>
      <SummarySection title="Secure QR"><div style={{ textAlign: 'center' }}><QrCode value={shareUrl} /><p style={{ color: C.sage, fontSize: 12 }}>This private link expires {formatTravelDate(summary.trip.travel_share_expires_at)}.</p></div></SummarySection>
      <p style={{ color: C.sage, fontSize: 12, lineHeight: 1.6 }}>Country requirements and fees should always be verified with the responsible government authority. Airline and airport sources are used only for their own policies and logistics.</p>
    </div>
  </main>;
}
