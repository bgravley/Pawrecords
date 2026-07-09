// api/admin-data.js
// Server-side admin data fetcher — uses service role key to bypass RLS
// Only callable with a valid admin check

async function checkedFetch(url, options, label) {
  const r = await fetch(url, options);
  if (!r.ok) {
    const errText = await r.text().catch(() => '');
    console.error(`${label} failed (${r.status}):`, errText);
    throw new Error(`${label} failed (${r.status})`);
  }
  return r;
}

// Writes admin-action failures to error_log so they show up in the admin
// Errors tab, not just Vercel's function logs. Never throws itself — a
// logging failure must never mask or replace the original error.
async function logAdminError(supabaseUrl, headers, context, userEmail, message) {
  try {
    await fetch(`${supabaseUrl}/rest/v1/error_log`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ context, user_email: userEmail || null, error_message: message }),
    });
  } catch (_) {
    // best-effort only
  }
}

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

  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

  const userToken = authHeader.replace('Bearer ', '');

  const verifyRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { 'Authorization': `Bearer ${userToken}`, 'apikey': serviceKey }
  });

  if (!verifyRes.ok) return res.status(401).json({ error: 'Invalid token' });

  const userData = await verifyRes.json();
  const requestingUserId = userData.id;

  const profileRes = await fetch(
    `${supabaseUrl}/rest/v1/profiles?id=eq.${requestingUserId}&select=is_admin,email`,
    { headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` } }
  );
  if (!profileRes.ok) {
    console.error('Admin profile lookup failed:', profileRes.status, await profileRes.text().catch(() => ''));
    return res.status(502).json({ error: 'Could not verify admin status — please try again.' });
  }
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
      const r = await checkedFetch(`${supabaseUrl}/rest/v1/profiles?select=*&order=created_at.desc`, { headers }, 'Load users');
      const data = await r.json();
      return res.status(200).json({ data });
    }

    if (type === 'ai_logs') {
      const r = await checkedFetch(`${supabaseUrl}/rest/v1/ai_usage_log?select=*&order=created_at.desc&limit=500`, { headers }, 'Load AI logs');
      const data = await r.json();
      return res.status(200).json({ data });
    }

    if (type === 'activity') {
      const r = await checkedFetch(`${supabaseUrl}/rest/v1/activity_log?select=*&order=created_at.desc&limit=200`, { headers }, 'Load activity');
      const data = await r.json();
      return res.status(200).json({ data });
    }

    if (type === 'errors') {
      const r = await checkedFetch(`${supabaseUrl}/rest/v1/error_log?select=*&order=created_at.desc&limit=200`, { headers }, 'Load errors');
      const data = await r.json();
      return res.status(200).json({ data });
    }

    if (type === 'user_pets') {
      const r = await checkedFetch(`${supabaseUrl}/rest/v1/dogs?user_id=eq.${userId}&select=*&order=created_at.desc`, { headers }, 'Load user pets');
      const data = await r.json();
      return res.status(200).json({ data });
    }

    if (type === 'update_user') {
      const { targetUserId, updates } = req.body;
      const r = await checkedFetch(
        `${supabaseUrl}/rest/v1/profiles?id=eq.${targetUserId}`,
        { method: 'PATCH', headers: { ...headers, 'Prefer': 'return=representation' }, body: JSON.stringify(updates) },
        'Update user'
      );
      const data = await r.json();
      return res.status(200).json({ data });
    }

    if (type === 'bug_reports') {
      const r = await checkedFetch(`${supabaseUrl}/rest/v1/bug_reports?select=*&order=created_at.desc`, { headers }, 'Load bug reports');
      const data = await r.json();
      return res.status(200).json({ data });
    }

    if (type === 'approve_bug_report') {
      const { reportId } = req.body;
      if (!reportId) return res.status(400).json({ error: 'reportId required' });

      try {
        const reportRes = await checkedFetch(`${supabaseUrl}/rest/v1/bug_reports?id=eq.${reportId}&select=*`, { headers }, 'Load bug report');
        const reports = await reportRes.json();
        const report = reports?.[0];
        if (!report) return res.status(404).json({ error: 'Report not found' });

        let rewardType = 'no_reward';
        let rewardMessage = '';

        if (report.user_id) {
          const profRes = await checkedFetch(
            `${supabaseUrl}/rest/v1/profiles?id=eq.${report.user_id}&select=email,subscription_tier,stripe_customer_id`,
            { headers }, 'Load reporter profile'
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
            const stripe = (await import('stripe')).default(process.env.STRIPE_SECRET_KEY);
            const subs = await stripe.subscriptions.list({ customer: profile.stripe_customer_id, status: 'active', limit: 1 });
            const sub = subs.data?.[0];

            if (sub) {
              const newTrialEnd = sub.current_period_end + (30 * 24 * 60 * 60);
              await stripe.subscriptions.update(sub.id, { trial_end: newTrialEnd, proration_behavior: 'none' });
              rewardType = 'month_extended';
              rewardMessage = "We've added a free month to your subscription as a thank-you — your next charge has been pushed back by 30 days.";
            } else {
              rewardType = 'no_active_subscription';
              rewardMessage = "Thanks for the report! We couldn't find an active subscription to extend, but we appreciate the catch.";
            }
          }

          if (profile?.email && process.env.RESEND_API_KEY) {
            const emailRes = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.RESEND_API_KEY}` },
              body: JSON.stringify({
                from: 'YourPetPass <notifications@yourpetpass.com>',
                to: profile.email,
                subject: '🐛 Your bug report was reviewed',
                html: `<div style="font-family:sans-serif;max-width:500px;margin:0 auto;"><div style="background:#1E5C52;padding:20px 24px;border-radius:12px 12px 0 0;"><img src="https://yourpetpass.com/logo_horizontal_cream_transparent.png" alt="YourPetPass" width="160" style="display:block;height:auto;" /></div><div style="padding:20px;"><h2>Thanks for reporting that!</h2><p>${rewardMessage}</p></div></div>`,
              }),
            });
            if (!emailRes.ok) console.error('Bug report outcome email failed (non-critical):', emailRes.status, await emailRes.text().catch(() => ''));
          }
        }

        await checkedFetch(
          `${supabaseUrl}/rest/v1/bug_reports?id=eq.${reportId}`,
          { method: 'PATCH', headers, body: JSON.stringify({ status: 'approved', reward_type: rewardType, reviewed_at: new Date().toISOString() }) },
          'Save bug report approval'
        );

        return res.status(200).json({ data: { approved: true, rewardType, rewardMessage } });
      } catch (err) {
        console.error('approve_bug_report failed:', err.message);
        return res.status(500).json({ error: err.message });
      }
    }

    if (type === 'reject_bug_report') {
      const { reportId } = req.body;
      await checkedFetch(
        `${supabaseUrl}/rest/v1/bug_reports?id=eq.${reportId}`,
        { method: 'PATCH', headers, body: JSON.stringify({ status: 'rejected', reviewed_at: new Date().toISOString() }) },
        'Reject bug report'
      );
      return res.status(200).json({ data: { rejected: true } });
    }

    if (type === 'delete_user') {
      const { targetUserId } = req.body;
      if (!targetUserId) return res.status(400).json({ error: 'targetUserId required' });

      // Every user-owned table already has a proper FK to profiles(id) with
      // either ON DELETE CASCADE (allergies, documents, dogs,
      // emergency_contacts, medications, saved_vets, trip_checklist_items,
      // trip_documents, trips, vaccinations, vet_visits, weights -- all of
      // it, pet records and trip records both) or ON DELETE SET NULL
      // (activity_log, ai_usage_log, bug_reports, error_log -- these are
      // anonymized, not deleted, preserving aggregate history). Deleting the
      // profile row is sufficient; the database does the rest correctly.
      //
      // A previous version of this handler manually deleted from each table
      // one at a time, including a call to a table named "vets" that has
      // never existed (the real table is "saved_vets") -- every delete
      // attempt failed on that step. Relying on the DB's own cascade rules
      // removes an entire class of exactly this bug. Verified live: created
      // a throwaway test account with a dog, vaccination, saved vet, trip,
      // and activity_log row, deleted the profile, confirmed every
      // CASCADE table emptied and every SET NULL table anonymized correctly.

      let targetEmail = null;
      try {
        const profLookup = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${targetUserId}&select=email`, { headers });
        const profData = await profLookup.json().catch(() => []);
        targetEmail = profData?.[0]?.email || null;
      } catch (_) { /* best-effort, only used for error log context */ }

      try {
        // Explicit status update: the FK's ON DELETE SET NULL will null out
        // affiliates.user_id automatically, but won't touch status -- do
        // that here so the affiliate record is left clearly cancelled.
        const affRes = await fetch(`${supabaseUrl}/rest/v1/affiliates?user_id=eq.${targetUserId}`, {
          method: 'PATCH', headers, body: JSON.stringify({ status: 'cancelled' }),
        });
        if (!affRes.ok) console.error('Affiliate deactivation failed (non-critical):', affRes.status);

        const profDelRes = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${targetUserId}`, { method: 'DELETE', headers });
        if (!profDelRes.ok) {
          const errText = await profDelRes.text().catch(() => '');
          throw new Error(`Failed to delete profile row (${profDelRes.status}): ${errText}`);
        }

        const authDeleteRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${targetUserId}`, {
          method: 'DELETE',
          headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` },
        });

        if (!authDeleteRes.ok && authDeleteRes.status !== 404) {
          const errText = await authDeleteRes.text();
          console.error('Auth user deletion failed:', errText);
          await logAdminError(supabaseUrl, headers, 'user_delete_partial', targetEmail,
            `Profile data deleted, but auth login removal failed: ${errText}`);
          return res.status(200).json({ data: { partial: true, warning: 'Account data deleted, but the auth login itself could not be removed. Contact Supabase support if this persists.' } });
        }

        return res.status(200).json({ data: { deleted: true } });
      } catch (err) {
        console.error('delete_user failed:', err.message);
        await logAdminError(supabaseUrl, headers, 'user_delete_failed', targetEmail, err.message);
        return res.status(500).json({ error: err.message });
      }
    }

    if (type === 'mark_error_reviewed') {
      const { errorId, reviewed } = req.body;
      const r = await checkedFetch(
        `${supabaseUrl}/rest/v1/error_log?id=eq.${errorId}`,
        { method: 'PATCH', headers: { ...headers, 'Prefer': 'return=representation' }, body: JSON.stringify({ reviewed: reviewed !== false }) },
        'Update error reviewed status'
      );
      const data = await r.json();
      return res.status(200).json({ data });
    }

    if (type === 'error_count') {
      const r = await checkedFetch(
        `${supabaseUrl}/rest/v1/error_log?reviewed=eq.false&select=id`,
        { headers: { ...headers, 'Prefer': 'count=exact', 'Range-Unit': 'items', 'Range': '0-0' } },
        'Load error count'
      );
      const countHeader = r.headers.get('content-range');
      const count = countHeader ? parseInt(countHeader.split('/')[1]) || 0 : 0;
      return res.status(200).json({ count });
    }

    if (type === 'affiliates') {
      const r = await checkedFetch(`${supabaseUrl}/rest/v1/affiliates?select=*&order=created_at.desc`, { headers }, 'Load affiliates');
      const data = await r.json();
      return res.status(200).json({ data });
    }

    if (type === 'affiliate_commissions') {
      const r = await checkedFetch(`${supabaseUrl}/rest/v1/affiliate_commissions?select=*&order=created_at.desc&limit=500`, { headers }, 'Load affiliate commissions');
      const data = await r.json();
      return res.status(200).json({ data });
    }

    if (type === 'create_affiliate') {
      const { userId: targetUserId, referralCode, commissionRate, notes } = req.body;
      const r = await checkedFetch(
        `${supabaseUrl}/rest/v1/affiliates`,
        {
          method: 'POST',
          headers: { ...headers, 'Prefer': 'return=representation' },
          body: JSON.stringify({
            user_id: targetUserId,
            referral_code: referralCode,
            commission_rate: commissionRate || 25,
            status: 'active',
            notes: notes || null,
          }),
        },
        'Create affiliate'
      );
      const data = await r.json();
      return res.status(200).json({ data: Array.isArray(data) ? data[0] : data });
    }

    if (type === 'update_affiliate') {
      const { affiliateId, updates } = req.body;
      const r = await checkedFetch(
        `${supabaseUrl}/rest/v1/affiliates?id=eq.${affiliateId}`,
        { method: 'PATCH', headers: { ...headers, 'Prefer': 'return=representation' }, body: JSON.stringify(updates) },
        'Update affiliate'
      );
      const data = await r.json();
      return res.status(200).json({ data });
    }

    if (type === 'payout_summary') {
      // Rolls up unpaid commission balances per affiliate. No payment
      // processor involved -- this just tells you who's owed what and how
      // they want to be paid (payout_paypal / payout_stripe_email, which
      // affiliates fill in themselves in their portal). You send the money
      // yourself, then call mark_commissions_paid.
      try {
        const commRes = await checkedFetch(
          `${supabaseUrl}/rest/v1/affiliate_commissions?status=eq.pending&select=affiliate_id,commission_amount_cents`,
          { headers }, 'Load pending commissions'
        );
        const commissions = await commRes.json();

        const affRes = await checkedFetch(
          `${supabaseUrl}/rest/v1/affiliates?select=id,referral_code,payout_paypal,payout_stripe_email,user_id`,
          { headers }, 'Load affiliates for payout'
        );
        const affiliatesList = await affRes.json();

        const profileIds = affiliatesList.map(a => a.user_id).filter(Boolean);
        let profileMap = {};
        if (profileIds.length) {
          const profRes = await checkedFetch(
            `${supabaseUrl}/rest/v1/profiles?id=in.(${profileIds.join(',')})&select=id,email,full_name`,
            { headers }, 'Load affiliate profiles for payout'
          );
          const profilesList = await profRes.json();
          profileMap = Object.fromEntries(profilesList.map(p => [p.id, p]));
        }

        const totals = {};
        for (const c of commissions) {
          totals[c.affiliate_id] = (totals[c.affiliate_id] || 0) + (c.commission_amount_cents || 0);
        }

        const summary = affiliatesList
          .map(a => ({
            affiliateId: a.id,
            referralCode: a.referral_code,
            name: profileMap[a.user_id]?.full_name || '',
            email: profileMap[a.user_id]?.email || '',
            payoutPaypal: a.payout_paypal || null,
            payoutStripeEmail: a.payout_stripe_email || null,
            pendingCents: totals[a.id] || 0,
          }))
          .filter(s => s.pendingCents > 0)
          .sort((a, b) => b.pendingCents - a.pendingCents);

        return res.status(200).json({ data: summary });
      } catch (err) {
        console.error('payout_summary failed:', err.message);
        await logAdminError(supabaseUrl, headers, 'payout_summary_failed', null, err.message);
        return res.status(500).json({ error: err.message });
      }
    }

    if (type === 'prewarm_routes') {
      const r = await checkedFetch(
        `${supabaseUrl}/rest/v1/prewarm_routes?select=*&order=added_at.desc`,
        { headers }, 'Load prewarm routes'
      );
      const data = await r.json();
      return res.status(200).json({ data });
    }

    if (type === 'prewarm_route_suggestions') {
      // Real routes that have actually been researched (present in
      // travel_route_cache) but aren't in the curated prewarm_routes list
      // yet -- candidates for you to review and approve, per your call to
      // keep this reviewed rather than fully automatic.
      try {
        const cacheRes = await checkedFetch(
          `${supabaseUrl}/rest/v1/travel_route_cache?select=origin_country,destination_country,transportation_mode&order=created_at.desc&limit=500`,
          { headers }, 'Load cached routes'
        );
        const cachedRoutes = await cacheRes.json();

        const routesRes = await checkedFetch(
          `${supabaseUrl}/rest/v1/prewarm_routes?select=origin_country,destination_country,transportation_mode`,
          { headers }, 'Load existing prewarm routes'
        );
        const existingRoutes = await routesRes.json();
        const existingKeys = new Set(existingRoutes.map(r =>
          `${r.origin_country.toLowerCase()}|${r.destination_country.toLowerCase()}|${r.transportation_mode.toLowerCase()}`
        ));

        const seen = new Set();
        const suggestions = [];
        for (const c of cachedRoutes) {
          const key = `${(c.origin_country||'').toLowerCase()}|${(c.destination_country||'').toLowerCase()}|${(c.transportation_mode||'').toLowerCase()}`;
          if (existingKeys.has(key) || seen.has(key)) continue;
          seen.add(key);
          suggestions.push({
            originCountry: c.origin_country,
            destinationCountry: c.destination_country,
            transportationMode: c.transportation_mode,
          });
        }
        return res.status(200).json({ data: suggestions });
      } catch (err) {
        console.error('prewarm_route_suggestions failed:', err.message);
        return res.status(500).json({ error: err.message });
      }
    }

    if (type === 'prewarm_route_add') {
      const { originCountry, destinationCountry, transportationMode, source } = req.body;
      if (!originCountry || !destinationCountry) return res.status(400).json({ error: 'originCountry and destinationCountry required' });
      const r = await fetch(`${supabaseUrl}/rest/v1/prewarm_routes`, {
        method: 'POST',
        headers: { ...headers, 'Prefer': 'return=representation' },
        body: JSON.stringify({
          origin_country: originCountry,
          destination_country: destinationCountry,
          transportation_mode: transportationMode || 'air',
          source: source || 'auto-detected',
        }),
      });
      if (!r.ok) {
        const errText = await r.text().catch(() => '');
        return res.status(409).json({ error: errText.includes('duplicate') ? 'That route is already on the list.' : `Could not add route (${r.status})` });
      }
      const data = await r.json();
      return res.status(200).json({ data: Array.isArray(data) ? data[0] : data });
    }

    if (type === 'prewarm_route_remove') {
      const { routeId } = req.body;
      if (!routeId) return res.status(400).json({ error: 'routeId required' });
      await checkedFetch(
        `${supabaseUrl}/rest/v1/prewarm_routes?id=eq.${routeId}`,
        { method: 'DELETE', headers }, 'Remove prewarm route'
      );
      return res.status(200).json({ data: { removed: true } });
    }

    if (type === 'mark_commissions_paid') {
      const { affiliateId, payoutMethod } = req.body;
      if (!affiliateId) return res.status(400).json({ error: 'affiliateId required' });
      try {
        const r = await fetch(`${supabaseUrl}/rest/v1/affiliate_commissions?affiliate_id=eq.${affiliateId}&status=eq.pending`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ status: 'paid', payout_method: payoutMethod || null }),
        });
        if (!r.ok) {
          const errText = await r.text().catch(() => '');
          throw new Error(`Failed to mark commissions paid (${r.status}): ${errText}`);
        }
        return res.status(200).json({ data: { marked: true } });
      } catch (err) {
        console.error('mark_commissions_paid failed:', err.message);
        await logAdminError(supabaseUrl, headers, 'mark_paid_failed', null, err.message);
        return res.status(500).json({ error: err.message });
      }
    }

    return res.status(400).json({ error: 'Unknown type' });

  } catch (err) {
    console.error('Admin data error:', err);
    return res.status(500).json({ error: err.message });
  }
}
