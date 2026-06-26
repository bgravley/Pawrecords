// api/admin-data.js
// Server-side admin data fetcher — uses service role key to bypass RLS
// Only callable with a valid admin check

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Server not configured' });
  }

  const { type, userId } = req.body;

  // Verify the requesting user is actually an admin
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

  const userToken = authHeader.replace('Bearer ', '');

  // Verify token and check admin status
  const verifyRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      'Authorization': `Bearer ${userToken}`,
      'apikey': serviceKey,
    }
  });

  if (!verifyRes.ok) return res.status(401).json({ error: 'Invalid token' });

  const userData = await verifyRes.json();
  const requestingUserId = userData.id;

  // Check if user is admin
  const profileRes = await fetch(
    `${supabaseUrl}/rest/v1/profiles?id=eq.${requestingUserId}&select=is_admin,email`,
    { headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` } }
  );
  const profiles = await profileRes.json();
  const isAdmin = profiles?.[0]?.is_admin === true ||
    profiles?.[0]?.email === 'bgravley@rdmarketingllc.com';

  if (!isAdmin) return res.status(403).json({ error: 'Admin access required' });

  const headers = {
    'apikey': serviceKey,
    'Authorization': `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  };

  try {
    if (type === 'users') {
      const r = await fetch(
        `${supabaseUrl}/rest/v1/profiles?select=*&order=created_at.desc`,
        { headers }
      );
      const data = await r.json();
      return res.status(200).json({ data });
    }

    if (type === 'ai_logs') {
      const r = await fetch(
        `${supabaseUrl}/rest/v1/ai_usage_log?select=*&order=created_at.desc&limit=500`,
        { headers }
      );
      const data = await r.json();
      return res.status(200).json({ data });
    }

    if (type === 'activity') {
      const r = await fetch(
        `${supabaseUrl}/rest/v1/activity_log?select=*&order=created_at.desc&limit=200`,
        { headers }
      );
      const data = await r.json();
      return res.status(200).json({ data });
    }

    if (type === 'errors') {
      const r = await fetch(
        `${supabaseUrl}/rest/v1/error_log?select=*&order=created_at.desc&limit=200`,
        { headers }
      );
      const data = await r.json();
      return res.status(200).json({ data });
    }

    if (type === 'user_pets') {
      // Get all pets for a specific user
      const r = await fetch(
        `${supabaseUrl}/rest/v1/dogs?user_id=eq.${userId}&select=*&order=created_at.desc`,
        { headers }
      );
      const data = await r.json();
      return res.status(200).json({ data });
    }

    if (type === 'update_user') {
      const { targetUserId, updates } = req.body;
      const r = await fetch(
        `${supabaseUrl}/rest/v1/profiles?id=eq.${targetUserId}`,
        {
          method: 'PATCH',
          headers: { ...headers, 'Prefer': 'return=representation' },
          body: JSON.stringify(updates),
        }
      );
      const data = await r.json();
      return res.status(200).json({ data });
    }

    if (type === 'bug_reports') {
      const r = await fetch(`${supabaseUrl}/rest/v1/bug_reports?select=*&order=created_at.desc`, { headers });
      const data = await r.json();
      return res.status(200).json({ data });
    }

    if (type === 'approve_bug_report') {
      const { reportId } = req.body;
      if (!reportId) return res.status(400).json({ error: 'reportId required' });

      try {
        // Get the report and the reporting user's profile
        const reportRes = await fetch(`${supabaseUrl}/rest/v1/bug_reports?id=eq.${reportId}&select=*`, { headers });
        const reports = await reportRes.json();
        const report = reports?.[0];
        if (!report) return res.status(404).json({ error: 'Report not found' });

        let rewardType = 'no_reward';
        let rewardMessage = '';

        if (report.user_id) {
          const profRes = await fetch(
            `${supabaseUrl}/rest/v1/profiles?id=eq.${report.user_id}&select=email,subscription_tier,stripe_customer_id`,
            { headers }
          );
          const profiles = await profRes.json();
          const profile = profiles?.[0];

          if (profile?.subscription_tier === 'lifetime') {
            rewardType = 'lifetime_thanks';
            rewardMessage = "You're already on Lifetime, so there's no extra month to add — but we really appreciate you catching this!";
          } else if (profile?.subscription_tier === 'free' || !profile?.stripe_customer_id) {
            rewardType = 'free_tier_thanks';
            rewardMessage = "Thanks for the report! Since you're on the free plan there's no subscription to extend, but we appreciate you flagging this.";
          } else {
            // Premium (Monthly or Annual) — extend trial_end by 1 month from their current renewal date
            const stripe = (await import('stripe')).default(process.env.STRIPE_SECRET_KEY);
            const subs = await stripe.subscriptions.list({ customer: profile.stripe_customer_id, status: 'active', limit: 1 });
            const sub = subs.data?.[0];

            if (sub) {
              const newTrialEnd = sub.current_period_end + (30 * 24 * 60 * 60); // +1 month (30 days)
              await stripe.subscriptions.update(sub.id, { trial_end: newTrialEnd, proration_behavior: 'none' });
              rewardType = 'month_extended';
              rewardMessage = "We've added a free month to your subscription as a thank-you — your next charge has been pushed back by 30 days.";
            } else {
              rewardType = 'no_active_subscription';
              rewardMessage = "Thanks for the report! We couldn't find an active subscription to extend, but we appreciate the catch.";
            }
          }

          // Email the user about the outcome
          if (profile?.email && process.env.RESEND_API_KEY) {
            await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.RESEND_API_KEY}` },
              body: JSON.stringify({
                from: 'YourPetPass <notifications@yourpetpass.com>',
                to: profile.email,
                subject: '🐛 Your bug report was reviewed',
                html: `<div style="font-family:sans-serif;padding:20px;"><h2>Thanks for reporting that!</h2><p>${rewardMessage}</p></div>`,
              }),
            });
          }
        }

        await fetch(`${supabaseUrl}/rest/v1/bug_reports?id=eq.${reportId}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ status: 'approved', reward_type: rewardType, reviewed_at: new Date().toISOString() }),
        });

        return res.status(200).json({ data: { approved: true, rewardType, rewardMessage } });
      } catch (err) {
        console.error('approve_bug_report failed:', err.message);
        return res.status(500).json({ error: err.message });
      }
    }

    if (type === 'reject_bug_report') {
      const { reportId } = req.body;
      await fetch(`${supabaseUrl}/rest/v1/bug_reports?id=eq.${reportId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: 'rejected', reviewed_at: new Date().toISOString() }),
      });
      return res.status(200).json({ data: { rejected: true } });
    }

    if (type === 'delete_user') {
      const { targetUserId } = req.body;
      if (!targetUserId) return res.status(400).json({ error: 'targetUserId required' });

      try {
        // Get this user's pet IDs first — vaccinations/visits/etc. are keyed by dog_id, not user_id
        const dogsRes = await fetch(`${supabaseUrl}/rest/v1/dogs?user_id=eq.${targetUserId}&select=id`, { headers });
        const dogs = await dogsRes.json();
        const dogIds = (dogs || []).map(d => d.id);

        // Delete pet-keyed records for every pet this user owns
        for (const dogId of dogIds) {
          await Promise.all([
            fetch(`${supabaseUrl}/rest/v1/vaccinations?dog_id=eq.${dogId}`, { method: 'DELETE', headers }),
            fetch(`${supabaseUrl}/rest/v1/medications?dog_id=eq.${dogId}`, { method: 'DELETE', headers }),
            fetch(`${supabaseUrl}/rest/v1/allergies?dog_id=eq.${dogId}`, { method: 'DELETE', headers }),
            fetch(`${supabaseUrl}/rest/v1/vet_visits?dog_id=eq.${dogId}`, { method: 'DELETE', headers }),
            fetch(`${supabaseUrl}/rest/v1/weights?dog_id=eq.${dogId}`, { method: 'DELETE', headers }),
            fetch(`${supabaseUrl}/rest/v1/documents?dog_id=eq.${dogId}`, { method: 'DELETE', headers }),
            fetch(`${supabaseUrl}/rest/v1/emergency_contacts?dog_id=eq.${dogId}`, { method: 'DELETE', headers }),
          ]);
        }

        // Delete user-keyed records
        const tripsRes = await fetch(`${supabaseUrl}/rest/v1/trips?user_id=eq.${targetUserId}&select=id`, { headers });
        const trips = await tripsRes.json();
        for (const trip of (trips || [])) {
          await Promise.all([
            fetch(`${supabaseUrl}/rest/v1/trip_checklist_items?trip_id=eq.${trip.id}`, { method: 'DELETE', headers }),
            fetch(`${supabaseUrl}/rest/v1/trip_documents?trip_id=eq.${trip.id}`, { method: 'DELETE', headers }),
          ]);
        }
        await Promise.all([
          fetch(`${supabaseUrl}/rest/v1/trips?user_id=eq.${targetUserId}`, { method: 'DELETE', headers }),
          fetch(`${supabaseUrl}/rest/v1/dogs?user_id=eq.${targetUserId}`, { method: 'DELETE', headers }),
          fetch(`${supabaseUrl}/rest/v1/vets?user_id=eq.${targetUserId}`, { method: 'DELETE', headers }),
        ]);

        // If they were an affiliate, deactivate rather than delete (keep commission history intact)
        await fetch(`${supabaseUrl}/rest/v1/affiliates?user_id=eq.${targetUserId}`, {
          method: 'PATCH', headers, body: JSON.stringify({ status: 'cancelled', user_id: null }),
        });

        // Delete the profile row
        await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${targetUserId}`, { method: 'DELETE', headers });

        // Finally, delete the actual auth user — this is what makes the email re-usable for signup again
        const authDeleteRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${targetUserId}`, {
          method: 'DELETE',
          headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` },
        });

        if (!authDeleteRes.ok && authDeleteRes.status !== 404) {
          const errText = await authDeleteRes.text();
          console.error('Auth user deletion failed:', errText);
          return res.status(200).json({ data: { partial: true, warning: 'Account data deleted, but the auth login itself could not be removed. Contact Supabase support if this persists.' } });
        }

        return res.status(200).json({ data: { deleted: true } });
      } catch (err) {
        console.error('delete_user failed:', err.message);
        return res.status(500).json({ error: err.message });
      }
    }

    if (type === 'mark_error_reviewed') {
      const { errorId, reviewed } = req.body; // reviewed: true|false — caller controls direction
      const r = await fetch(
        `${supabaseUrl}/rest/v1/error_log?id=eq.${errorId}`,
        {
          method: 'PATCH',
          headers: { ...headers, 'Prefer': 'return=representation' },
          body: JSON.stringify({ reviewed: reviewed !== false }), // defaults to true if not specified
        }
      );
      const data = await r.json();
      return res.status(200).json({ data });
    }

    if (type === 'error_count') {
      const r = await fetch(
        `${supabaseUrl}/rest/v1/error_log?reviewed=eq.false&select=id`,
        { headers: { ...headers, 'Prefer': 'count=exact', 'Range-Unit': 'items', 'Range': '0-0' } }
      );
      const countHeader = r.headers.get('content-range');
      const count = countHeader ? parseInt(countHeader.split('/')[1]) || 0 : 0;
      return res.status(200).json({ count });
    }

    // ── Affiliate endpoints ──────────────────────────────────────────────
    if (type === 'affiliates') {
      const r = await fetch(
        `${supabaseUrl}/rest/v1/affiliates?select=*&order=created_at.desc`,
        { headers }
      );
      const data = await r.json();
      return res.status(200).json({ data });
    }

    if (type === 'affiliate_commissions') {
      const r = await fetch(
        `${supabaseUrl}/rest/v1/affiliate_commissions?select=*&order=created_at.desc&limit=500`,
        { headers }
      );
      const data = await r.json();
      return res.status(200).json({ data });
    }

    if (type === 'create_affiliate') {
      const { userId: targetUserId, referralCode, commissionRate, notes } = req.body;
      const r = await fetch(
        `${supabaseUrl}/rest/v1/affiliates`,
        {
          method: 'POST',
          headers: { ...headers, 'Prefer': 'return=representation' },
          body: JSON.stringify({
            user_id: targetUserId,
            referral_code: referralCode,
            commission_rate: commissionRate || 20,
            status: 'active',
            notes: notes || null,
          }),
        }
      );
      const data = await r.json();
      return res.status(200).json({ data: Array.isArray(data) ? data[0] : data });
    }

    if (type === 'update_affiliate') {
      const { affiliateId, updates } = req.body;
      const r = await fetch(
        `${supabaseUrl}/rest/v1/affiliates?id=eq.${affiliateId}`,
        {
          method: 'PATCH',
          headers: { ...headers, 'Prefer': 'return=representation' },
          body: JSON.stringify(updates),
        }
      );
      const data = await r.json();
      return res.status(200).json({ data });
    }

    return res.status(400).json({ error: 'Unknown type' });

  } catch (err) {
    console.error('Admin data error:', err);
    return res.status(500).json({ error: err.message });
  }
}
