// Public emergency-record endpoint. A caller must possess the exact high-
// entropy emergency token. The browser never receives raw table access and
// only a deliberately limited emergency data set is returned.

function validToken(value) {
  return typeof value === 'string' && /^[a-f0-9]{32}$/i.test(value);
}

async function sb(path) {
  const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: process.env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
    },
  });
  if (!response.ok) throw new Error(`Supabase request failed (${response.status})`);
  return response.json();
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'Emergency record unavailable' });
  }

  const token = req.query?.token;
  if (!validToken(token)) return res.status(404).json({ error: 'Record not found' });

  try {
    const dogs = await sb(
      `dogs?emergency_token=eq.${encodeURIComponent(token)}` +
      '&select=id,name,species,breed,dob,weight,gender,neutered,microchip,color,pet_type,emergency_contact,emergency_phone,emergency_phone_code,emergency_whatsapp,emergency_whatsapp_code&limit=1'
    );

    const dog = dogs?.[0];
    if (!dog?.id) return res.status(404).json({ error: 'Record not found' });

    const dogId = encodeURIComponent(dog.id);
    const [vaccinations, medications, allergies] = await Promise.all([
      sb(`vaccinations?dog_id=eq.${dogId}&select=name,date_given,next_due,vet_name&type=neq.deleted&order=date_given.desc`)
        .catch(() => sb(`vaccinations?dog_id=eq.${dogId}&select=name,date_given,next_due,vet_name&order=date_given.desc`)),
      sb(`medications?dog_id=eq.${dogId}&active=eq.true&select=name,dosage,frequency,reason`),
      sb(`allergies?dog_id=eq.${dogId}&select=allergen,reaction,severity`),
    ]);

    return res.status(200).json({
      pet: {
        name: dog.name,
        species: dog.species,
        breed: dog.breed,
        dob: dog.dob,
        weight: dog.weight,
        gender: dog.gender,
        neutered: dog.neutered,
        microchip: dog.microchip,
        color: dog.color,
        pet_type: dog.pet_type,
        emergency_contact: dog.emergency_contact,
        emergency_phone: dog.emergency_phone,
        emergency_phone_code: dog.emergency_phone_code,
        emergency_whatsapp: dog.emergency_whatsapp,
        emergency_whatsapp_code: dog.emergency_whatsapp_code,
      },
      allergies: allergies || [],
      medications: medications || [],
      vaccinations: vaccinations || [],
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Emergency record lookup failed:', error);
    return res.status(503).json({ error: 'Emergency record unavailable' });
  }
}
