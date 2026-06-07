// api/send-notifications.js
// Called daily by a cron job (Vercel Cron or external)
// Sends vaccine reminders, travel document reminders, and weekly digest

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = 'YourPetPass <notifications@yourpetpass.com>';
const APP_URL = 'https://yourpetpass.com';

// ── EMAIL SENDER ──────────────────────────────────────────
async function sendEmail({ to, subject, html }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  });
  const data = await res.json();
  if (!res.ok) console.error('Resend error:', data);
  return res.ok;
}

// ── SUPABASE FETCH HELPER ─────────────────────────────────
async function sb(path, opts = {}) {
  const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      'apikey': process.env.SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...opts.headers,
    },
    ...opts,
  });
  return res.json();
}

// ── DATE HELPERS ──────────────────────────────────────────
function daysUntil(dateStr) {
  if (!dateStr) return null;
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + 'T00:00:00');
  return Math.round((target - now) / 86400000);
}

function fmt(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function isWeeklyDigestDay() {
  return new Date().getDay() === 1; // Monday
}

// ── EMAIL TEMPLATES ───────────────────────────────────────
function emailWrapper(content) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body { font-family: 'Georgia', serif; background: #FAF6F0; margin: 0; padding: 20px; }
  .container { max-width: 600px; margin: 0 auto; background: #FFFFFF; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(44,32,23,0.08); }
  .header { background: #1E5C52; padding: 28px 32px; }
  .logo { font-size: 24px; color: #FFFFFF; font-weight: 900; }
  .logo span { color: #F5C45E; }
  .tagline { color: rgba(255,255,255,0.7); font-size: 13px; margin-top: 4px; font-style: italic; }
  .body { padding: 28px 32px; }
  .footer { background: #FAF6F0; padding: 20px 32px; text-align: center; font-size: 12px; color: #8B7355; border-top: 1px solid #E8DDD0; }
  .btn { display: inline-block; background: #2D7D6F; color: #FFFFFF; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-weight: 700; font-size: 14px; margin-top: 16px; }
  .alert-card { border-radius: 12px; padding: 16px; margin: 10px 0; border-left: 4px solid; }
  .alert-urgent { background: #C4714A14; border-color: #C4714A; }
  .alert-warning { background: #E8A83814; border-color: #E8A838; }
  .alert-ok { background: #2D7D6F14; border-color: #2D7D6F; }
  .pet-section { margin: 20px 0; }
  .pet-name { font-size: 18px; font-weight: 700; color: #2C2017; margin-bottom: 12px; border-bottom: 1px solid #E8DDD0; padding-bottom: 8px; }
  .item-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #F0E8DC; font-size: 14px; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 11px; font-weight: 700; }
  .badge-red { background: #C4714A20; color: #C4714A; }
  .badge-amber { background: #E8A83820; color: #E8A838; }
  .badge-green { background: #2D7D6F20; color: #2D7D6F; }
  h2 { color: #1E5C52; font-size: 20px; margin-top: 0; }
  p { color: #5A4535; line-height: 1.7; font-size: 15px; }
</style></head><body>
<div class="container">
  <div class="header">
    <div class="logo">🐾 Your<span>Pet</span>Pass</div>
    <div class="tagline">Your pet's health passport</div>
  </div>
  <div class="body">${content}</div>
  <div class="footer">
    <p style="margin:0 0 8px;">© 2026 YourPetPass · <a href="${APP_URL}" style="color:#2D7D6F;">Open App</a> · <a href="${APP_URL}/unsubscribe" style="color:#8B7355;">Unsubscribe</a></p>
    <p style="margin:0;font-size:11px;">You're receiving this because you have an active YourPetPass account.</p>
  </div>
</div>
</body></html>`;
}

function vaccineReminderEmail({ petName, vaccineName, dueDate, days, ownerName }) {
  const urgency = days <= 7 ? 'urgent' : days <= 30 ? 'warning' : 'ok';
  const urgencyText = days <= 7 ? '⚠️ Urgent' : days <= 30 ? '📅 Coming Up' : '🗓 Reminder';
  return emailWrapper(`
    <h2>${urgencyText}: ${vaccineName} Due for ${petName}</h2>
    <p>Hi ${ownerName || 'there'},</p>
    <p>${petName}'s <strong>${vaccineName}</strong> vaccination is due in <strong>${days} day${days !== 1 ? 's' : ''}</strong> on <strong>${fmt(dueDate)}</strong>.</p>
    <div class="alert-card alert-${urgency}">
      <strong>${petName}</strong> · ${vaccineName}<br>
      <span style="font-size:13px;color:#5A4535;">Due: ${fmt(dueDate)} · ${days} days away</span>
    </div>
    ${days <= 7 ? '<p style="color:#C4714A;font-weight:600;">⚠️ Schedule your vet appointment now to avoid your pet being overdue.</p>' : ''}
    <a href="${APP_URL}" class="btn">View ${petName}'s Records →</a>
  `);
}

function travelReminderEmail({ ownerName, tripName, items }) {
  const itemsHtml = items.map(item => {
    const urgency = item.days <= 3 ? 'urgent' : item.days <= 7 ? 'warning' : 'ok';
    const badge = item.days <= 3 ? 'badge-red' : item.days <= 7 ? 'badge-amber' : 'badge-green';
    return `
      <div class="alert-card alert-${urgency}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;">
          <div>
            <strong>${item.title}</strong><br>
            <span style="font-size:12px;color:#5A4535;">Due: ${fmt(item.deadline_date)}</span>
          </div>
          <span class="badge ${badge}">${item.days}d left</span>
        </div>
        ${item.notes ? `<div style="font-size:12px;color:#C4714A;margin-top:6px;">⚠ ${item.notes}</div>` : ''}
      </div>`;
  }).join('');

  return emailWrapper(`
    <h2>✈️ Travel Action Items Due Soon</h2>
    <p>Hi ${ownerName || 'there'},</p>
    <p>You have upcoming deadlines for your trip <strong>${tripName}</strong>. Some items need to be completed well before your departure date.</p>
    ${itemsHtml}
    <a href="${APP_URL}" class="btn">View Trip Checklist →</a>
    <p style="font-size:13px;color:#8B7355;margin-top:16px;">Remember: USDA endorsement takes 1–3 business days by mail. Don't wait until the last minute.</p>
  `);
}

function weeklyDigestEmail({ ownerName, overdueVaccines, upcomingVaccines, travelItems, trips }) {
  const hasAnything = overdueVaccines.length || upcomingVaccines.length || travelItems.length;

  const overdueHtml = overdueVaccines.length ? `
    <div style="margin-bottom:20px;">
      <div style="font-size:11px;font-weight:700;color:#C4714A;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;">⚠ Overdue Vaccines</div>
      ${overdueVaccines.map(v => `
        <div class="item-row">
          <span><strong>${v.petName}</strong> · ${v.name}</span>
          <span class="badge badge-red">Overdue ${Math.abs(v.days)}d</span>
        </div>`).join('')}
    </div>` : '';

  const upcomingHtml = upcomingVaccines.length ? `
    <div style="margin-bottom:20px;">
      <div style="font-size:11px;font-weight:700;color:#E8A838;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;">📅 Upcoming Vaccines</div>
      ${upcomingVaccines.map(v => `
        <div class="item-row">
          <span><strong>${v.petName}</strong> · ${v.name}</span>
          <span class="badge badge-amber">Due in ${v.days}d</span>
        </div>`).join('')}
    </div>` : '';

  const travelHtml = travelItems.length ? `
    <div style="margin-bottom:20px;">
      <div style="font-size:11px;font-weight:700;color:#2D7D6F;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;">✈️ Travel Documents Due Soon</div>
      ${travelItems.map(t => `
        <div class="item-row">
          <span><strong>${t.tripName}</strong> · ${t.title}</span>
          <span class="badge ${t.days <= 7 ? 'badge-red' : 'badge-amber'}">Due in ${t.days}d</span>
        </div>`).join('')}
    </div>` : '';

  const noNewsHtml = !hasAnything ? `
    <div style="text-align:center;padding:24px 0;color:#2D7D6F;">
      <div style="font-size:32px;margin-bottom:8px;">✅</div>
      <div style="font-weight:700;font-size:16px;">All clear this week!</div>
      <div style="font-size:13px;color:#8B7355;margin-top:4px;">No upcoming vaccines or travel deadlines.</div>
    </div>` : '';

  return emailWrapper(`
    <h2>🐾 Your Weekly Pet Health Summary</h2>
    <p>Hi ${ownerName || 'there'}, here's everything coming up for your pets this week.</p>
    ${overdueHtml}${upcomingHtml}${travelHtml}${noNewsHtml}
    <a href="${APP_URL}" class="btn">Open YourPetPass →</a>
  `);
}

// ── MAIN HANDLER ──────────────────────────────────────────
export default async function handler(req, res) {
  // Verify cron secret so this can't be called publicly
  const secret = req.headers['x-cron-secret'];
  if (secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!RESEND_API_KEY) {
    return res.status(500).json({ error: 'RESEND_API_KEY not configured' });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isMonday = today.getDay() === 1;

  // Load all users with email notifications enabled
  const profiles = await sb('profiles?select=id,email,full_name,email_notifications&email_notifications=neq.false');
  
  let emailsSent = 0;
  const errors = [];

  for (const profile of profiles) {
    if (!profile.email) continue;

    const ownerName = profile.full_name?.split(' ')[0] || 'there';

    try {
      // ── Load this user's pets ──
      const dogs = await sb(`dogs?user_id=eq.${profile.id}&select=id,name,photo_url`);
      if (!dogs?.length) continue;

      const dogIds = dogs.map(d => d.id).join(',');

      // ── Load vaccines ──
      const vaccines = await sb(`vaccinations?dog_id=in.(${dogIds})&select=*&order=next_due`);

      // ── Vaccine reminders: 60, 30, 7 days ──
      for (const v of vaccines || []) {
        if (!v.next_due) continue;
        const days = daysUntil(v.next_due);
        if (days === null) continue;
        const pet = dogs.find(d => d.id === v.dog_id);
        if (!pet) continue;

        // Only send on exact trigger days
        if (days === 60 || days === 30 || days === 7) {
          const sent = await sendEmail({
            to: profile.email,
            subject: `${pet.name}'s ${v.name} is due in ${days} days`,
            html: vaccineReminderEmail({
              petName: pet.name,
              vaccineName: v.name,
              dueDate: v.next_due,
              days,
              ownerName,
            }),
          });
          if (sent) emailsSent++;
        }
      }

      // ── Travel document reminders: 14, 7, 3, 2 days before item deadline ──
      const trips = await sb(`trips?user_id=eq.${profile.id}&status=neq.completed&status=neq.cancelled&select=id,name,origin_city,destination_city`);
      
      for (const trip of trips || []) {
        const items = await sb(`trip_checklist_items?trip_id=eq.${trip.id}&is_completed=eq.false&deadline_date=not.is.null&select=*`);
        const dueItems = (items || []).filter(item => {
          const days = daysUntil(item.deadline_date);
          return days !== null && (days === 14 || days === 7 || days === 3 || days === 2);
        }).map(item => ({ ...item, days: daysUntil(item.deadline_date) }));

        if (dueItems.length > 0) {
          const tripName = trip.name || `${trip.origin_city} → ${trip.destination_city}`;
          const sent = await sendEmail({
            to: profile.email,
            subject: `✈️ ${dueItems.length} travel action${dueItems.length > 1 ? 's' : ''} due soon — ${tripName}`,
            html: travelReminderEmail({ ownerName, tripName, items: dueItems }),
          });
          if (sent) emailsSent++;
        }
      }

      // ── Weekly digest — Mondays only ──
      if (isMonday) {
        // Overdue vaccines
        const overdueVaccines = (vaccines || [])
          .filter(v => v.next_due && daysUntil(v.next_due) !== null && daysUntil(v.next_due) < 0)
          .map(v => ({ ...v, petName: dogs.find(d => d.id === v.dog_id)?.name || '?', days: daysUntil(v.next_due) }));

        // Upcoming vaccines (within 60 days)
        const upcomingVaccines = (vaccines || [])
          .filter(v => v.next_due && daysUntil(v.next_due) !== null && daysUntil(v.next_due) >= 0 && daysUntil(v.next_due) <= 60)
          .map(v => ({ ...v, petName: dogs.find(d => d.id === v.dog_id)?.name || '?', days: daysUntil(v.next_due) }));

        // Travel items due within 30 days
        const allTravelItems = [];
        for (const trip of trips || []) {
          const items = await sb(`trip_checklist_items?trip_id=eq.${trip.id}&is_completed=eq.false&deadline_date=not.is.null&select=title,deadline_date,notes`);
          const tripName = trip.name || `${trip.origin_city} → ${trip.destination_city}`;
          (items || []).forEach(item => {
            const days = daysUntil(item.deadline_date);
            if (days !== null && days >= 0 && days <= 30) {
              allTravelItems.push({ ...item, tripName, days });
            }
          });
        }

        const sent = await sendEmail({
          to: profile.email,
          subject: `🐾 Your weekly pet health summary`,
          html: weeklyDigestEmail({
            ownerName,
            overdueVaccines,
            upcomingVaccines,
            travelItems: allTravelItems.sort((a, b) => a.days - b.days),
            trips: trips || [],
          }),
        });
        if (sent) emailsSent++;
      }

    } catch (err) {
      console.error(`Error processing ${profile.email}:`, err.message);
      errors.push({ email: profile.email, error: err.message });
    }
  }

  return res.status(200).json({
    success: true,
    emailsSent,
    usersProcessed: profiles.length,
    errors: errors.length ? errors : undefined,
    isMonday,
  });
}
