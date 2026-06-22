// api/newsletter-signup.js
// Captures email addresses from the marketing page newsletter signup form.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { email } = req.body;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  try {
    const res2 = await fetch(`${process.env.SUPABASE_URL}/rest/v1/newsletter_subscribers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        'Prefer': 'return=minimal,resolution=ignore-duplicates', // silently ignore if already subscribed
      },
      body: JSON.stringify({ email: email.toLowerCase().trim() }),
    });

    if (!res2.ok && res2.status !== 409) {
      const err = await res2.text();
      console.error('Newsletter signup insert failed:', err);
      return res.status(500).json({ error: 'Could not sign up right now. Please try again.' });
    }

    return res.status(200).json({ subscribed: true });
  } catch (err) {
    console.error('Newsletter signup error:', err.message);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}
