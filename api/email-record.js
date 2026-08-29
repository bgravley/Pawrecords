// api/email-record.js
// Sends a pet's health-record summary to a recipient. The caller must own the
// pet, and the record body is generated from server-fetched Supabase rows.
// Browser-supplied HTML is never embedded in YourPetPass-branded email.

import { verifyUser } from './_verifyUser.js';
import { setCorsHeaders } from './_cors.js';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = 'YourPetPass <notifications@yourpetpass.com>';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function esc(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmt(value) {
  if (!value) return '—';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return esc(value);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

function serviceHeaders() {
  return {
    apikey: process.env.SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
  };
}

async function sb(path) {
  const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${path}`, { headers: serviceHeaders() });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Supabase record lookup failed (${response.status}): ${detail.slice(0, 160)}`);
  }
  return response.json();
}

async function ownedRecord(userId, petId) {
  const dogs = await sb(
    `dogs?id=eq.${encodeURIComponent(petId)}&user_id=eq.${encodeURIComponent(userId)}` +
    '&select=id,name,species,breed,dob,weight,microchip,pet_type,emergency_contact,emergency_phone&limit=1'
  );
  const dog = dogs?.[0];
  if (!dog?.id) return null;

  const dogId = encodeURIComponent(dog.id);
  const [vaccinations, medications, allergies, visits] = await Promise.all([
    sb(`vaccinations?dog_id=eq.${dogId}&select=name,type,date_given,next_due,vet_name&order=date_given.desc`),
    sb(`medications?dog_id=eq.${dogId}&select=name,dosage,frequency,active&order=name.asc`),
    sb(`allergies?dog_id=eq.${dogId}&select=allergen,reaction,severity&order=allergen.asc`),
    sb(`vet_visits?dog_id=eq.${dogId}&select=visit_date,vet_name,clinic,reason,diagnosis&order=visit_date.desc`),
  ]);

  return { dog, vaccinations, medications, allergies, visits };
}

function petTypeLabel(type) {
  if (type === 'service_animal') return 'Service Animal';
  if (type === 'esa') return 'Emotional Support Animal';
  return '';
}

function table(headers, rows) {
  if (!rows.length) return '';
  return `<table role="presentation" style="width:100%;border-collapse:collapse;font-size:13px;line-height:1.5;">
    <thead><tr>${headers.map(h => `<th style="background:#EAF4EE;color:#1A2E22;padding:8px 10px;text-align:left;border-bottom:1px solid #D7E5DC;">${esc(h)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(row => `<tr>${row.map(cell => `<td style="padding:8px 10px;border-bottom:1px solid #E4ECE7;vertical-align:top;">${cell}</td>`).join('')}</tr>`).join('')}</tbody>
  </table>`;
}

function section(title, body) {
  return `<h2 style="font-family:Georgia,'Times New Roman',serif;color:#2C4A38;font-size:16px;margin:26px 0 10px;border-bottom:2px solid #2C4A38;padding-bottom:6px;">${esc(title)}</h2>${body}`;
}

function buildRecord(record) {
  const { dog, vaccinations, medications, allergies, visits } = record;
  const type = petTypeLabel(dog.pet_type);
  const profileRows = [
    ['Name', `${esc(dog.name)}${type ? ` · ${esc(type)}` : ''}`],
    ['Species', esc(dog.species || '—')],
    ['Breed', esc(dog.breed || '—')],
    ['Born', fmt(dog.dob)],
    ['Weight', dog.weight ? `${esc(dog.weight)} lbs` : '—'],
    ['Microchip', esc(dog.microchip || '—')],
  ];
  if (dog.emergency_contact || dog.emergency_phone) {
    profileRows.push(['Emergency contact', `${esc(dog.emergency_contact || '')}${dog.emergency_phone ? ` ${esc(dog.emergency_phone)}` : ''}`]);
  }

  const allergyRows = allergies.map(a => [
    `<strong>${esc(a.allergen || '—')}</strong>`, esc(a.reaction || '—'), esc(a.severity || '—'),
  ]);
  const vaccinationRows = vaccinations.map(v => [
    `<strong>${esc(v.name || '—')}</strong>`, esc(v.type || '—'), fmt(v.date_given), fmt(v.next_due), esc(v.vet_name || '—'),
  ]);
  const medicationRows = medications.map(m => [
    `<strong>${esc(m.name || '—')}</strong>`, esc(m.dosage || '—'), esc(m.frequency || '—'), m.active ? 'Active' : 'Completed',
  ]);
  const visitRows = visits.map(v => [
    fmt(v.visit_date), esc(v.vet_name || v.clinic || '—'), esc(v.reason || '—'), esc(v.diagnosis || '—'),
  ]);

  return `
    <div style="font-size:13px;color:#7C9E87;margin-bottom:20px;">Generated ${esc(new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }))} · YourPetPass</div>
    ${section('Profile', table(['Field', 'Details'], profileRows))}
    ${allergyRows.length ? section('Allergies', table(['Allergen', 'Reaction', 'Severity'], allergyRows)) : ''}
    ${section('Vaccinations', vaccinationRows.length ? table(['Vaccine', 'Type', 'Given', 'Next Due', 'Vet'], vaccinationRows) : '<p>No vaccinations recorded.</p>')}
    ${medicationRows.length ? section('Medications', table(['Medication', 'Dosage', 'Frequency', 'Status'], medicationRows)) : ''}
    ${visitRows.length ? section('Vet Visits', table(['Date', 'Vet / Clinic', 'Reason', 'Diagnosis'], visitRows)) : ''}
  `;
}

function validatedPdfUrl(raw, userId) {
  if (!raw || typeof raw !== 'string' || raw.length > 1200) return null;
  try {
    const url = new URL(raw, 'https://www.yourpetpass.com');
    if (!['yourpetpass.com', 'www.yourpetpass.com'].includes(url.hostname)) return null;
    if (url.pathname !== '/api/storage-file') return null;
    const path = url.searchParams.get('path') || '';
    const prefix = `${userId}/shared-records/`;
    if (!path.startsWith(prefix) || path.includes('..') || path.includes('\\')) return null;
    return `https://www.yourpetpass.com/api/storage-file?path=${encodeURIComponent(path)}`;
  } catch {
    return null;
  }
}

function wrap(petName, senderEmail, recordHtml, note, pdfUrl) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:20px;background:#FAFCFB;font-family:Georgia,'Times New Roman',serif;color:#1A2E22;">
  <div style="max-width:720px;margin:0 auto;background:#FFFFFF;border:1px solid #DCE8E0;border-radius:16px;overflow:hidden;">
    <div style="background:#2C4A38;padding:20px 24px;">
      <img src="https://yourpetpass.com/logo_horizontal_cream_transparent.png" alt="YourPetPass" width="180" style="display:block;height:auto;margin-bottom:10px;" />
      <div style="color:#FFFFFF;font-size:19px;font-weight:700;">${esc(petName)}'s Health Record</div>
      <div style="color:#9DC4AA;font-size:13px;margin-top:4px;">Shared via YourPetPass${senderEmail ? ` by ${esc(senderEmail)}` : ''}</div>
    </div>
    ${pdfUrl ? `<div style="background:#EAF4EE;border-bottom:1px solid #DCE8E0;padding:16px 24px;text-align:center;"><a href="${esc(pdfUrl)}" style="display:inline-block;background:#C9A84C;color:#1A2E22;text-decoration:none;font-weight:700;font-size:14px;padding:12px 24px;border-radius:10px;">View PDF version</a></div>` : ''}
    ${note ? `<div style="padding:16px 24px;border-bottom:1px solid #DCE8E0;color:#2C4A38;font-size:14px;font-style:italic;">“${esc(note)}”</div>` : ''}
    <div style="padding:4px 24px 28px;">${recordHtml}</div>
    <div style="background:#EAF4EE;padding:14px 24px;color:#7C9E87;font-size:11px;text-align:center;">YourPetPass · Health Records &amp; Travel, Simplified.</div>
  </div>
</body></html>`;
}

export default async function handler(req, res) {
  setCorsHeaders(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!RESEND_API_KEY || !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'Email service unavailable' });
  }

  const auth = await verifyUser(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const { recipientEmail, petId, note, pdfUrl } = req.body || {};
  if (!recipientEmail || !petId) return res.status(400).json({ error: 'recipientEmail and petId are required.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail) || recipientEmail.length > 254) {
    return res.status(400).json({ error: 'Please enter a valid recipient email address.' });
  }
  if (!UUID_RE.test(petId)) return res.status(400).json({ error: 'Invalid pet.' });
  if (note && (typeof note !== 'string' || note.length > 1000)) {
    return res.status(400).json({ error: 'Note is too long (max 1000 characters).' });
  }

  try {
    const record = await ownedRecord(auth.userId, petId);
    if (!record) return res.status(404).json({ error: 'Pet not found.' });

    const safePdfUrl = validatedPdfUrl(pdfUrl, auth.userId);
    const html = wrap(record.dog.name, auth.email, buildRecord(record), note || '', safePdfUrl);
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: recipientEmail,
        reply_to: auth.email || undefined,
        subject: `${record.dog.name}'s Health Record — shared via YourPetPass`,
        html,
      }),
    });

    if (!emailRes.ok) {
      const detail = await emailRes.text().catch(() => '');
      console.error('Email record Resend error:', emailRes.status, detail.slice(0, 250));
      return res.status(502).json({ error: 'Could not send the email. Please try again.' });
    }
    return res.status(200).json({ sent: true });
  } catch (err) {
    console.error('Email record error:', err.message);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}
