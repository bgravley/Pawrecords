// TravelModule.jsx — YourPetPass Travel Feature
// Paste this entire file into GitHub as: src/Travel.jsx

import { useState, useEffect, useRef } from "react";
import { supabase } from "./lib/supabase";

const logActivity = async (userId, userEmail, action, details = {}) => {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || supabaseKey;
    await fetch(`${supabaseUrl}/rest/v1/activity_log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': supabaseKey, 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ user_id: userId, user_email: userEmail, action, details })
    });
  } catch (e) { /* silent fail */ }
};

const logError = async (userId, userEmail, context, errorMessage) => {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || supabaseKey;
    await fetch(`${supabaseUrl}/rest/v1/error_log`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ user_id: userId, user_email: userEmail, context, error_message: errorMessage, reviewed: false })
    });
  } catch (e) { /* silent fail */ }
};

// Stripe Price ID for the "3 extra travel checklists for $2.99" pack.
// Create this product in Stripe (live mode) and replace this placeholder.
const TRAVEL_CREDIT_PACK_PRICE_ID = "price_1TkvYNB5s5OlwZVJ737k5nA5";

const COUNTRIES = [
  "Afghanistan","Albania","Algeria","Andorra","Angola","Antigua and Barbuda","Argentina","Armenia","Australia","Austria",
  "Azerbaijan","Bahamas","Bahrain","Bangladesh","Barbados","Belarus","Belgium","Belize","Benin","Bhutan",
  "Bolivia","Bosnia and Herzegovina","Botswana","Brazil","Brunei","Bulgaria","Burkina Faso","Burundi","Cabo Verde","Cambodia",
  "Cameroon","Canada","Central African Republic","Chad","Chile","China","Colombia","Comoros","Congo","Costa Rica",
  "Croatia","Cuba","Cyprus","Czech Republic","Denmark","Djibouti","Dominica","Dominican Republic","Ecuador","Egypt",
  "El Salvador","Equatorial Guinea","Eritrea","Estonia","Eswatini","Ethiopia","Fiji","Finland","France","Gabon",
  "Gambia","Georgia","Germany","Ghana","Greece","Grenada","Guatemala","Guinea","Guinea-Bissau","Guyana",
  "Haiti","Honduras","Hungary","Iceland","India","Indonesia","Iran","Iraq","Ireland","Israel",
  "Italy","Jamaica","Japan","Jordan","Kazakhstan","Kenya","Kiribati","Kuwait","Kyrgyzstan","Laos",
  "Latvia","Lebanon","Lesotho","Liberia","Libya","Liechtenstein","Lithuania","Luxembourg","Madagascar","Malawi",
  "Malaysia","Maldives","Mali","Malta","Marshall Islands","Mauritania","Mauritius","Mexico","Micronesia","Moldova",
  "Monaco","Mongolia","Montenegro","Morocco","Mozambique","Myanmar","Namibia","Nauru","Nepal","Netherlands",
  "New Zealand","Nicaragua","Niger","Nigeria","North Korea","North Macedonia","Norway","Oman","Pakistan","Palau",
  "Palestine","Panama","Papua New Guinea","Paraguay","Peru","Philippines","Poland","Portugal","Qatar","Romania",
  "Russia","Rwanda","Saint Kitts and Nevis","Saint Lucia","Saint Vincent and the Grenadines","Samoa","San Marino",
  "Sao Tome and Principe","Saudi Arabia","Senegal","Serbia","Seychelles","Sierra Leone","Singapore","Slovakia",
  "Slovenia","Solomon Islands","Somalia","South Africa","South Korea","South Sudan","Spain","Sri Lanka","Sudan",
  "Suriname","Sweden","Switzerland","Syria","Taiwan","Tajikistan","Tanzania","Thailand","Timor-Leste","Togo",
  "Tonga","Trinidad and Tobago","Tunisia","Turkey","Turkmenistan","Tuvalu","Uganda","Ukraine","United Arab Emirates",
  "United Kingdom","United States","Uruguay","Uzbekistan","Vanuatu","Vatican City","Venezuela","Vietnam",
  "Yemen","Zambia","Zimbabwe"
];

const C = {
  bg:"#FAF6F0",surface:"#FFFFFF",card:"#FFFFFF",border:"#E8DDD0",
  accent:"#2D7D6F",accentDim:"#2D7D6F14",accentDark:"#1E5C52",
  warn:"#E8A838",warnDim:"#E8A83814",
  danger:"#C4714A",dangerDim:"#C4714A14",
  text:"#2C2017",sub:"#5A4535",muted:"#8B7355",
  shadow:"0 2px 12px rgba(44,32,23,0.08)",
};

const uid = () => Math.random().toString(36).slice(2, 9);
const today = () => new Date().toISOString().slice(0, 10);
const fmt = d => {
  if (!d) return "—";
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};
const daysUntil = d => {
  if (!d) return null;
  const n = new Date(); n.setHours(12, 0, 0, 0);
  return Math.round((new Date(d + "T12:00:00") - n) / 86400000);
};

const tripStatus = (trip) => {
  const days = daysUntil(trip.departure_date);
  if (trip.status === 'completed') return { color: C.accent, label: 'Completed' };
  if (trip.status === 'cancelled') return { color: C.muted, label: 'Cancelled' };
  if (days < 0) return { color: C.muted, label: 'Past' };
  if (days === 0) return { color: C.danger, label: 'Today!' };
  if (days <= 7) return { color: C.danger, label: `${days}d away` };
  if (days <= 30) return { color: C.warn, label: `${days}d away` };
  return { color: C.accent, label: `${days}d away` };
};

const Btn = ({ children, onClick, v = "primary", sm, full, style: s, disabled }) => {
  const V = {
    primary: { background: C.accent, color: "#fff" },
    secondary: { background: C.card, color: C.text, border: `1px solid ${C.border}` },
    danger: { background: C.dangerDim, color: C.danger, border: `1px solid ${C.danger}44` },
    amber: { background: C.warn, color: "#2C2017" },
  };
  return (
    <button onClick={disabled ? undefined : onClick}
      style={{ ...V[v], borderRadius: 12, fontWeight: 700, display: "inline-flex", alignItems: "center",
        gap: 6, width: full ? "100%" : "auto", justifyContent: full ? "center" : "flex-start",
        padding: sm ? "7px 14px" : "10px 20px", fontSize: sm ? 13 : 14,
        opacity: disabled ? 0.5 : 1, border: "none", cursor: "pointer",
        fontFamily: "'Nunito', sans-serif", ...s }}
      onMouseEnter={e => !disabled && (e.currentTarget.style.opacity = "0.85")}
      onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
      {children}
    </button>
  );
};

const Card = ({ children, style: s, onClick }) => (
  <div onClick={onClick} style={{
    background: C.card, border: `1px solid ${C.border}`, borderRadius: 16,
    padding: 18, boxShadow: C.shadow, ...s,
    cursor: onClick ? "pointer" : "default", transition: "box-shadow .2s"
  }}
    onMouseEnter={e => onClick && (e.currentTarget.style.boxShadow = "0 4px 20px rgba(44,32,23,0.14)")}
    onMouseLeave={e => onClick && (e.currentTarget.style.boxShadow = C.shadow)}>
    {children}
  </div>
);

const Badge = ({ label, color }) => (
  <span style={{
    background: color + "20", color, border: `1px solid ${color}44`,
    borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap"
  }}>{label}</span>
);

const Field = ({ label, children, col }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 5, gridColumn: col }}>
    <label style={{ fontSize: 11, fontWeight: 800, color: C.sub, textTransform: "uppercase", letterSpacing: ".08em" }}>{label}</label>
    {children}
  </div>
);

const Modal = ({ title, onClose, children, wide }) => (
  <div style={{
    position: "fixed", inset: 0, background: "#00000088", zIndex: 500,
    display: "flex", alignItems: "center", justifyContent: "center", padding: 16
  }} onClick={e => e.target === e.currentTarget && onClose()}>
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20,
      width: "100%", maxWidth: wide ? 620 : 500, maxHeight: "92vh",
      overflow: "auto", padding: 24, boxShadow: "0 8px 40px rgba(44,32,23,0.15)"
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h3 style={{ fontFamily: "'Lora', serif", fontSize: 22, color: C.text }}>{title}</h3>
        <button onClick={onClose} style={{
          background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8,
          padding: "6px 10px", color: C.sub, cursor: "pointer"
        }}>✕</button>
      </div>
      {children}
    </div>
  </div>
);

const inp = {
  background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 10,
  padding: "10px 14px", color: C.text, fontSize: 14, width: "100%", outline: "none",
  fontFamily: "'Nunito', sans-serif",
};

// ── AI REQUIREMENTS ENGINE — calls OpenAI directly ───────
const generateChecklist = async (trip, pets, userId) => {
  const speciesInvolved = [...new Set(pets.map(p => p.species || 'dog'))]; // ['dog'] | ['cat'] | ['dog','cat']
  const petList = pets.map(p =>
    `${p.name} (${p.species === 'cat' ? 'Cat' : 'Dog'}, ${p.breed || 'mixed'}${p.is_service_animal ? ', SERVICE ANIMAL' : ''}${p.is_esa ? ', ESA' : ''})`
  ).join('; ');

  // US territories count as USA for all federal pet travel requirements
  const US_TERRITORIES = [
    "United States", "Puerto Rico", "Guam", "US Virgin Islands",
    "U.S. Virgin Islands", "American Samoa", "Northern Mariana Islands",
    "United States Virgin Islands"
  ];
  const US_CITIES = ["san juan", "ponce", "bayamon", "mayaguez", "carolina"]; // PR cities
  
  const originCity = (trip.origin_city || "").toLowerCase();
  const destCity = (trip.destination_city || "").toLowerCase();
  
  const isOriginUSA = US_TERRITORIES.includes(trip.origin_country) ||
    US_TERRITORIES.some(t => (trip.origin_country || "").includes(t)) ||
    US_CITIES.some(c => originCity.includes(c));
  const isDestUSA = US_TERRITORIES.includes(trip.destination_country) ||
    US_TERRITORIES.some(t => (trip.destination_country || "").includes(t)) ||
    US_CITIES.some(c => destCity.includes(c));
  const usaInvolved = isOriginUSA || isDestUSA;

  const transportLabels = { air: "Flying (airplane)", sea: "By Sea (cruise ship or ferry)", land: "Driving (personal vehicle)", bus: "Bus" };
  const transportMode = trip.transportation_type || "air";

  const prompt = `You are a veterinary travel compliance expert specializing in international pet travel documentation. Generate a COMPLETE, ACCURATE, and ACTIONABLE pet travel checklist for this route.

TRIP DETAILS:
- Origin: ${trip.origin_city}, ${trip.origin_country}
- Destination: ${trip.destination_city}, ${trip.destination_country}
- Departure Date: ${trip.departure_date}
- Mode of Transportation: ${transportLabels[transportMode] || "Flying"}
- ${transportMode === "air" ? "Airline" : transportMode === "sea" ? "Cruise Line/Ferry" : transportMode === "bus" ? "Bus Company" : "Carrier"}: ${trip.airline || "not specified"}
- Pets: ${petList}

===== CRITICAL: TAG EVERY ITEM BY SPECIES =====
This trip involves: ${speciesInvolved.join(' and ')}.
Dog and cat travel requirements are NOT always identical, even on the same route — for example, some countries require FeLV/FIV testing for cats but not dogs, and some require different parasite treatments. Research each species' requirements independently where they could plausibly differ (do not assume they're identical just because the route is the same).

For EVERY checklist item, you MUST include an "applies_to" field set to exactly "dog" or "cat" — every item belongs to one species or the other, no exceptions.
- If a requirement genuinely applies identically to both species (e.g., a generic customs form that doesn't differ by species), include it TWICE as two separate items — once tagged "dog", once tagged "cat".
- If a requirement differs by species (e.g., FeLV/FIV testing for cats, different vaccination rules), tag each version with the correct, specific species.
- Research dog and cat requirements independently for this route — do not assume one species' rules automatically apply to the other.

===== IMPORTANT: TAILOR REQUIREMENTS TO THE MODE OF TRANSPORTATION =====
The pet is traveling by ${transportLabels[transportMode] || "air"}. Requirements differ meaningfully by mode:
${transportMode === "air" ? `- Focus on airline-specific cabin/cargo pet policies, carrier size/weight limits, breed restrictions for brachycephalic breeds (this applies to both flat-faced dog breeds like Bulldogs AND flat-faced cat breeds like Persians/Himalayans), and airport-specific procedures.` : ""}
${transportMode === "sea" ? `- Focus on the cruise line or ferry company's specific pet policy (many cruise lines do NOT allow pets in cabins — service animals only on most lines), kennel/boarding facilities on board if any, and port-of-call country entry requirements at EACH stop if this is a multi-country cruise.` : ""}
${transportMode === "land" ? `- Focus on land border crossing requirements specifically — these can differ from air entry requirements at the same border (e.g., different checkpoint hours, different document checks at land crossings vs international airports). Do NOT include airline-specific items.` : ""}
${transportMode === "bus" ? `- Focus on the specific bus company's pet policy (many intercity bus lines have limited or no pet allowances outside of service animals), and land border crossing requirements if this route crosses an international border. Do NOT include airline-specific items.` : ""}

===== CRITICAL RULE: USA INVOLVEMENT =====
${usaInvolved ? `
⚠️ THE UNITED STATES OR A US TERRITORY IS INVOLVED IN THIS TRIP. THE FOLLOWING USA REQUIREMENTS MUST BE INCLUDED AS SEPARATE CHECKLIST ITEMS — NO EXCEPTIONS:

IMPORTANT TIMING WARNING: ALL USA documentation must be completed BEFORE the pet leaves the United States. If the pet has already left the USA, it is too late — they will face 28-day quarantine or a titer test (blood test to prove rabies immunity) upon return, which costs $300-500 and requires waiting weeks for results.

NOTE: Puerto Rico, Guam, US Virgin Islands, American Samoa, and Northern Mariana Islands are US territories subject to the SAME federal CDC and USDA requirements as the continental United States. If origin or destination is any US territory, ALL items below are required.

MANDATORY USA CHECKLIST ITEMS TO INCLUDE:

1. "USDA-Accredited Veterinarian Health Exam" (deadline: 10 days before departure from USA)
   - The examining vet MUST be USDA-accredited (not just any licensed vet)
   - Find USDA-accredited vets at: https://www.aphis.usda.gov/pet-travel
   - Vet completes APHIS Form 7001 (health certificate)
   - This exam must happen within 10 days of the departure date FROM the USA
   - Cost: $75-200 depending on vet

2. "USDA APHIS State Office Endorsement — MUST BE DONE BEFORE LEAVING USA" (deadline: 5-7 days before USA departure)
   - After the vet signs Form 7001, the owner must send or hand-deliver the original signed form to their state's USDA APHIS Veterinary Services office for an official government endorsement stamp
   - This CANNOT be done from abroad — it must happen before the pet leaves the USA
   - Processing takes 1-3 business days by mail, same-day if hand-delivered
   - Find your state USDA office: https://www.aphis.usda.gov/pet-travel
   - Cost: $38 federal fee plus any state fees
   - ⚠️ WARNING: Skipping this step means the pet will be quarantined for 28 days or required to complete a titer test upon return to the USA

3. "CDC Dog Import Online Form" (deadline: 2-5 business days before USA arrival)
   - Required for ALL dogs entering the USA since 2024
   - Submit online at: https://www.cdc.gov/importation/dogs
   - Must be submitted before arrival — cannot be done at the border

4. "Valid US-Issued Rabies Vaccination Certificate" 
   - Dog must have been vaccinated against rabies IN THE UNITED STATES by a licensed US veterinarian
   - Certificate must show: vet name, vet license number, vaccine brand, lot number, date given, expiration date
   - If the rabies vaccine was given abroad, it may NOT be accepted by US Customs — get a US vet to administer or re-administer before departure
   - Source: https://www.cdc.gov/importation/dogs
` : "No USA-specific documentation required for this route."}

===== DIRECTION-SPECIFIC REQUIREMENTS =====

EXPORT from ${trip.origin_country} (rules for LEAVING the origin country):
${isOriginUSA ? "- USDA APHIS Form 7001 health certificate (see USA requirements above)" : ""}
${trip.origin_country === "Colombia" ? "- ICA (Instituto Colombiano Agropecuario) export health certificate — apply at ica.gov.co" : ""}
- Any other export requirements specific to ${trip.origin_country}

IMPORT into ${trip.destination_country} (rules for ENTERING the destination country):
${isDestUSA ? "- See USA requirements above (CDC form, endorsed health cert, rabies cert)" : ""}
${trip.destination_country === "Colombia" ? `- ICA import permit — apply online at https://www.ica.gov.co before travel
- Health certificate issued by licensed vet in ${trip.origin_country}, endorsed by ${trip.origin_country} agricultural authority
- Current rabies vaccination certificate (valid, not expired)
- Internal and external parasite treatment certificate dated within 15 days of travel` : ""}
- Any other import requirements specific to ${trip.destination_country}

===== ${transportMode === "air" ? "AIRLINE" : transportMode === "sea" ? "CRUISE/FERRY" : transportMode === "bus" ? "BUS COMPANY" : "CARRIER"} REQUIREMENTS =====
${transportMode === "air" ? `Always include a checklist item for ${trip.airline || "the airline"} with:
- Cabin vs cargo policy for pets
- Carrier/crate size and weight limits
- Whether breed restrictions apply (especially brachycephalic/snub-nosed breeds)
- How far in advance to book pet travel
- Pet fees
- Source: the airline's official pet policy page` : transportMode === "sea" ? `Always include a checklist item for ${trip.airline || "the cruise line/ferry company"} with:
- Whether pets are allowed at all (many cruise lines only allow service animals)
- Any pet boarding/kennel facilities available on board
- Required documentation for boarding
- Source: the cruise line or ferry company's official pet policy page` : transportMode === "bus" ? `Always include a checklist item for ${trip.airline || "the bus company"} with:
- Whether pets are allowed (many intercity bus lines only allow service animals)
- Any carrier requirements
- Source: the bus company's official pet policy page` : `Note: traveling by personal vehicle — no carrier-specific policy applies. Focus entirely on the land border crossing document requirements at this specific border crossing.`}

===== OUTPUT FORMAT =====
Return ONLY a valid JSON array. No markdown, no backticks, no explanation text before or after.
Each item must have these exact fields:
- title: string (clear, specific title)
- description: string (step-by-step numbered instructions, include contacts, costs, timing)
- category: one of: health_certificate, vaccination, treatment, documentation, airline, government_form, entry_document, other
- applies_to: exactly "dog" or "cat" — every item belongs to one species or the other. This field is REQUIRED on every item. If a requirement applies to both species, output it as two separate items.
- deadline_days_before: number (days before USA departure date that this must be completed)
- window_start_days: number (how many days before travel the document becomes valid)
- window_end_days: number (0 means must be valid on travel day)
- requires_document: boolean
- source_url: string (official government or airline URL — never a blog or third party)
- notes: string (warnings, tips, common mistakes)

[`;

  const { data: { session: aiSession } } = await supabase.auth.getSession();
  const response = await fetch("/api/ai-travel", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${aiSession?.access_token || ''}`,
    },
    body: JSON.stringify({
      messages: [{ role: "user", content: prompt }],
      destination: `${trip.origin_city} to ${trip.destination_city}`,
      originCountry: trip.origin_country,
      destinationCountry: trip.destination_country,
      transportationType: trip.transportation_type || "air",
    }),
  });

  if (!response.ok) {
    let errBody = {};
    try { errBody = await response.json(); } catch (e) { /* not JSON */ }
    const error = new Error(errBody.error || `Request failed (${response.status})`);
    error.rateLimitExceeded = errBody.rateLimitExceeded || false;
    error.creditsBalance = errBody.creditsBalance || 0;
    error.generationsUsed = errBody.generationsUsed;
    error.generationsLimit = errBody.generationsLimit;
    throw error;
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || "";
  if (!text) throw new Error("Empty response from OpenAI");

  const start = text.indexOf('[');
  const end = text.lastIndexOf(']') + 1;
  if (start === -1 || end === 0) throw new Error(`No JSON array found. Got: ${text.slice(0, 200)}`);

  try {
    return JSON.parse(text.slice(start, end));
  } catch (e) {
    throw new Error(`JSON parse failed: ${e.message}`);
  }
};

// ── TRIP FORM ────────────────────────────────────────────
const emptyLeg = () => ({
  originCity: "", originCountry: "United States", originAirportCode: "",
  destinationCity: "", destinationCountry: "", destinationAirportCode: "",
  departureDate: "", transportationType: "air", airline: "", flightNumber: "",
});

const TripForm = ({ trip, userId, dogs, onSave, onClose }) => {
  const [f, setF] = useState(trip ? {
    name: trip.name || "",
    returnDate: trip.return_date || "",
    notes: trip.notes || "",
    selectedPets: trip.pet_ids || [],
  } : {
    name: "", returnDate: "", notes: "", selectedPets: [],
  });
  // Legs default to a single empty one (matches the simple, common case).
  // When editing a trip that has real trip_legs rows, those load in below;
  // otherwise a single leg is reconstructed from the trip's own flat columns.
  const [legs, setLegs] = useState(trip ? [{
    originCity: trip.origin_city || "", originCountry: trip.origin_country || "United States", originAirportCode: "",
    destinationCity: trip.destination_city || "", destinationCountry: trip.destination_country || "", destinationAirportCode: "",
    departureDate: trip.departure_date || "", transportationType: trip.transportation_type || "air",
    airline: trip.airline || "", flightNumber: trip.flight_number || "",
  }] : [emptyLeg()]);
  const [legsLoaded, setLegsLoaded] = useState(!trip);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  useEffect(() => {
    if (!trip) return;
    (async () => {
      const { data } = await supabase.from('trip_legs').select('*').eq('trip_id', trip.id).order('leg_order');
      if (data && data.length) {
        setLegs(data.map(l => ({
          originCity: l.origin_city, originCountry: l.origin_country, originAirportCode: l.origin_airport_code || "",
          destinationCity: l.destination_city, destinationCountry: l.destination_country, destinationAirportCode: l.destination_airport_code || "",
          departureDate: l.departure_date, transportationType: l.transportation_type,
          airline: l.airline || "", flightNumber: l.flight_number || "",
        })));
      }
      setLegsLoaded(true);
    })();
  }, [trip?.id]);

  const updateLeg = (i, k, v) => setLegs(prev => prev.map((l, idx) => idx === i ? { ...l, [k]: v } : l));
  const addLeg = () => setLegs(prev => {
    const last = prev[prev.length - 1];
    // Pre-fill the new leg's origin with the previous leg's destination —
    // that's the connection, most of the time.
    return [...prev, { ...emptyLeg(), originCity: last.destinationCity, originCountry: last.destinationCountry }];
  });
  const removeLeg = (i) => setLegs(prev => prev.filter((_, idx) => idx !== i));

  const togglePet = (id) => {
    setF(p => ({
      ...p,
      selectedPets: p.selectedPets.includes(id)
        ? p.selectedPets.filter(x => x !== id)
        : [...p.selectedPets, id]
    }));
  };

  const legsValid = legs.length > 0 && legs.every(l => l.originCity && l.destinationCity && l.departureDate);

  const save = async () => {
    if (!legsValid) return;
    setSaving(true);
    setSaveError(null);
    const first = legs[0], lastLeg = legs[legs.length - 1];
    const payload = {
      user_id: userId,
      name: f.name || `${first.originCity} → ${lastLeg.destinationCity}`,
      origin_city: first.originCity, origin_country: first.originCountry,
      destination_city: lastLeg.destinationCity, destination_country: lastLeg.destinationCountry,
      departure_date: first.departureDate, return_date: f.returnDate || null,
      transportation_type: first.transportationType, airline: first.airline, flight_number: first.flightNumber || null,
      notes: f.notes, pet_ids: f.selectedPets,
    };
    let result, error;
    if (trip) {
      const res = await supabase.from('trips').update(payload).eq('id', trip.id).select().single();
      result = res.data; error = res.error;
    } else {
      const res = await supabase.from('trips').insert(payload).select().single();
      result = res.data; error = res.error;
    }
    if (error) {
      console.error('Trip save failed:', error);
      setSaveError(error.message || 'Could not save this trip. Please try again.');
      setSaving(false);
      return;
    }
    if (result) {
      // Replace all legs with the current set. Simplest correct approach
      // given legs can be added/removed/reordered freely in this form --
      // trying to diff and patch individual rows isn't worth the
      // complexity for what's a handful of rows per trip. Always writes at
      // least one leg row (even for a simple single-destination trip) so
      // airport codes entered in the form are never silently lost.
      await supabase.from('trip_legs').delete().eq('trip_id', result.id);
      const legRows = legs.map((l, i) => ({
        trip_id: result.id, user_id: userId, leg_order: i + 1,
        origin_city: l.originCity, origin_country: l.originCountry, origin_airport_code: l.originAirportCode || null,
        destination_city: l.destinationCity, destination_country: l.destinationCountry, destination_airport_code: l.destinationAirportCode || null,
        departure_date: l.departureDate, transportation_type: l.transportationType,
        airline: l.airline || null, flight_number: l.flightNumber || null,
        is_layover: i < legs.length - 1,
      }));
      const { error: legsErr } = await supabase.from('trip_legs').insert(legRows);
      if (legsErr) console.error('Trip legs save failed (trip itself saved fine):', legsErr.message);
      onSave(result);
      if (!trip) { // only notify/log on NEW trips, not edits
        supabase.auth.getUser().then(({ data }) => {
          const email = data?.user?.email;
          logActivity(userId, email || null, 'trip_added', { origin: payload.origin_city, destination: payload.destination_city });
          if (email) {
            fetch('/api/notify-user-action', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ actionType: 'trip_added', recipientEmail: email, data: { tripName: payload.name, origin: payload.origin_city, destination: payload.destination_city } }),
            }).catch(() => {});
          }
        });
      }
    }
    setSaving(false);
  };

  const transportOpts = [["air", "✈️", "Flying"], ["sea", "🚢", "By Sea"], ["land", "🚗", "Driving"], ["bus", "🚌", "Bus"]];

  return (
    <Modal title={trip ? "Edit Trip" : "Plan New Trip"} onClose={onClose} wide>
      {!legsLoaded ? (
        <div style={{ textAlign: "center", padding: 30, color: C.muted }}>Loading...</div>
      ) : (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Field label="Trip Name (optional)">
          <input maxLength={150} style={inp} value={f.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Panama to Miami Summer 2026" />
        </Field>

        {legs.map((leg, i) => (
          <div key={i} style={{ background: C.bg, borderRadius: 14, padding: 16, border: `1px solid ${C.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 12, color: C.sub, textTransform: "uppercase", letterSpacing: ".08em" }}>
                {legs.length === 1 ? "✈️ Route" : i === 0 ? "✈️ Leg 1 — Departure" : `✈️ Leg ${i + 1}${i === legs.length - 1 ? " — Final Arrival" : " — Connection"}`}
              </div>
              {legs.length > 1 && (
                <button onClick={() => removeLeg(i)} type="button" style={{ background: "none", border: "none", color: C.danger, fontSize: 12, cursor: "pointer", fontWeight: 600 }}>Remove</button>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <Field label="From City"><input maxLength={150} style={inp} value={leg.originCity} onChange={e => updateLeg(i, "originCity", e.target.value)} placeholder="Panama City" /></Field>
              <Field label="From Country">
                <select style={{ ...inp, appearance: "none" }} value={leg.originCountry} onChange={e => updateLeg(i, "originCountry", e.target.value)}>
                  <option value="">Select country...</option>
                  {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <Field label="To City"><input maxLength={150} style={inp} value={leg.destinationCity} onChange={e => updateLeg(i, "destinationCity", e.target.value)} placeholder="Miami" /></Field>
              <Field label="To Country">
                <select style={{ ...inp, appearance: "none" }} value={leg.destinationCountry} onChange={e => updateLeg(i, "destinationCountry", e.target.value)}>
                  <option value="">Select country...</option>
                  {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
            </div>
            {leg.transportationType === "air" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <Field label="Departure Airport Code (optional)"><input maxLength={4} style={{...inp,textTransform:"uppercase"}} value={leg.originAirportCode} onChange={e => updateLeg(i, "originAirportCode", e.target.value.toUpperCase())} placeholder="PTY" /></Field>
                <Field label="Arrival Airport Code (optional)"><input maxLength={4} style={{...inp,textTransform:"uppercase"}} value={leg.destinationAirportCode} onChange={e => updateLeg(i, "destinationAirportCode", e.target.value.toUpperCase())} placeholder="MIA" /></Field>
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10, marginBottom: 10 }}>
              <Field label="Departure Date"><input style={inp} type="date" value={leg.departureDate} onChange={e => updateLeg(i, "departureDate", e.target.value)} /></Field>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: leg.transportationType !== "land" ? 10 : 0 }}>
              {transportOpts.map(([val, icon, label]) => (
                <button key={val} onClick={() => updateLeg(i, "transportationType", val)} type="button"
                  style={{ padding: "8px 4px", borderRadius: 8, textAlign: "center", cursor: "pointer", border: leg.transportationType === val ? `2px solid ${C.accent}` : `1px solid ${C.border}`, background: leg.transportationType === val ? `${C.accent}14` : "#fff" }}>
                  <div style={{ fontSize: 15 }}>{icon}</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: leg.transportationType === val ? C.accent : C.sub }}>{label}</div>
                </button>
              ))}
            </div>
            {leg.transportationType === "air" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Field label="Airline (optional)"><input maxLength={150} style={inp} value={leg.airline} onChange={e => updateLeg(i, "airline", e.target.value)} placeholder="e.g. Copa Airlines" /></Field>
                <Field label="Flight # (optional)"><input maxLength={150} style={inp} value={leg.flightNumber} onChange={e => updateLeg(i, "flightNumber", e.target.value)} placeholder="CM205" autoCapitalize="characters" /></Field>
              </div>
            )}
            {(leg.transportationType === "sea" || leg.transportationType === "bus") && (
              <Field label={leg.transportationType === "sea" ? "Cruise Line / Ferry (optional)" : "Bus Company (optional)"}>
                <input maxLength={150} style={inp} value={leg.airline} onChange={e => updateLeg(i, "airline", e.target.value)} />
              </Field>
            )}
          </div>
        ))}

        <button onClick={addLeg} type="button" style={{ background: "none", border: `1.5px dashed ${C.border}`, borderRadius: 12, padding: "12px", color: C.accent, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
          + Add a connection / stop
        </button>

        <Field label="Return Date (optional)"><input style={inp} type="date" value={f.returnDate} onChange={e => set("returnDate", e.target.value)} /></Field>

        <div>
          <div style={{ fontWeight: 800, fontSize: 12, color: C.sub, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10 }}>🐾 Which Pets Are Coming?</div>
          {dogs.length === 0
            ? <div style={{ color: C.muted, fontSize: 14 }}>No pets added yet. Add a pet first.</div>
            : <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {dogs.map(dog => (
                <label key={dog.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: f.selectedPets.includes(dog.id) ? C.accentDim : C.bg, borderRadius: 10, border: `1.5px solid ${f.selectedPets.includes(dog.id) ? C.accent : C.border}`, cursor: "pointer" }}>
                  <input type="checkbox" checked={f.selectedPets.includes(dog.id)} onChange={() => togglePet(dog.id)} style={{ width: 16, height: 16, accentColor: C.accent }} />
                  <span style={{ fontWeight: 600 }}>{dog.name}</span>
                  <span style={{ color: C.muted, fontSize: 13 }}>{dog.breed || "Mixed"}</span>
                  {dog.is_service_animal && <Badge label="Service Animal" color={C.accent} />}
                  {dog.is_esa && <Badge label="ESA" color={C.warn} />}
                </label>
              ))}
            </div>}
        </div>

        <Field label="Notes">
          <textarea maxLength={1000} style={{ ...inp, minHeight: 60 }} value={f.notes} onChange={e => set("notes", e.target.value)} placeholder="Any special notes about this trip..." />
        </Field>

        {saveError && (
          <div style={{ background: "#C4714A14", border: "1px solid #C4714A44", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#C4714A" }}>
            ⚠ {saveError}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <Btn v="secondary" onClick={onClose} full>Cancel</Btn>
          <Btn onClick={save} disabled={saving || !legsValid} full>
            {saving ? "Saving..." : (trip ? "Save Changes" : "Create Trip")}
          </Btn>
        </div>
      </div>
      )}
    </Modal>
  );
};

// ── TIMELINE VIEW ────────────────────────────────────────
// Groups checklist items by when they actually need to happen, instead of
// the flat/category-ish order they were generated in. This is the "what's
// due when, at a glance" view.
const categoryIcons = {
  health_certificate: "🩺", vaccination: "💉", treatment: "💊", documentation: "📄",
  airline: "✈️", government_form: "🏛️", entry_document: "🛂", other: "📌",
};
const ChecklistTimeline = ({ checklist, onEdit }) => {
  const buckets = [
    { key: "overdue", label: "⚠️ Overdue", color: C.danger },
    { key: "week", label: "This Week", color: C.warn },
    { key: "month", label: "This Month", color: C.accent },
    { key: "later", label: "Later", color: C.muted },
    { key: "none", label: "No Deadline Set", color: C.muted },
  ];
  const bucketed = { overdue: [], week: [], month: [], later: [], none: [] };
  for (const item of checklist) {
    const d = daysUntil(item.deadline_date || null);
    if (d === null) bucketed.none.push(item);
    else if (d < 0) bucketed.overdue.push(item);
    else if (d <= 7) bucketed.week.push(item);
    else if (d <= 30) bucketed.month.push(item);
    else bucketed.later.push(item);
  }
  for (const key of Object.keys(bucketed)) {
    bucketed[key].sort((a, b) => (a.deadline_date || "").localeCompare(b.deadline_date || ""));
  }
  return (
    <div>
      {buckets.map(b => bucketed[b.key].length > 0 && (
        <div key={b.key} style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 800, fontSize: 12, color: b.color, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
            {b.label} <span style={{ background: b.color + "22", color: b.color, borderRadius: 20, padding: "1px 8px", fontSize: 11 }}>{bucketed[b.key].length}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {bucketed[b.key].map(item => (
              <div key={item.id} onClick={() => onEdit(item)} style={{
                display: "flex", alignItems: "center", gap: 10, background: "#fff", border: `1px solid ${C.border}`,
                borderRadius: 10, padding: "10px 12px", cursor: "pointer", opacity: item.is_completed ? 0.55 : 1,
              }}>
                <span style={{ fontSize: 16 }}>{item.is_completed ? "✅" : (categoryIcons[item.category] || "📌")}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, textDecoration: item.is_completed ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</div>
                </div>
                <div style={{ fontSize: 12, color: C.muted, flexShrink: 0 }}>{item.deadline_date ? fmt(item.deadline_date) : ""}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

// ── CHECKLIST ITEM ───────────────────────────────────────
const ChecklistItem = ({ item, tripPets, onTogglePet, onToggleAll, onUpload, onDelete, onEdit }) => {
  const fr = useRef();
  const [expanded, setExpanded] = useState(false);
  const days = daysUntil(item.deadline_date || null);
  const petCompletions = item.pet_completions || {};
  
  // If no pets on trip, fall back to single checkbox mode
  const hasPets = tripPets && tripPets.length > 0;
  const allDone = hasPets
    ? tripPets.every(p => petCompletions[p.id] === true)
    : item.is_completed;
  const someDone = hasPets && tripPets.some(p => petCompletions[p.id] === true);
  const isOverdue = days !== null && days < 0 && !allDone;
  const isUrgent = days !== null && days <= 7 && days >= 0 && !allDone;

  const categoryColors = {
    health_certificate: C.accent, vaccination: "#4CAF50", treatment: C.warn,
    documentation: C.sub, airline: "#2D7D6F", government_form: C.danger,
    entry_document: C.warn, other: C.muted,
  };
  const categoryLabels = {
    health_certificate: "Health Certificate", vaccination: "Vaccination", treatment: "Treatment",
    documentation: "Documentation", airline: "Airline", government_form: "Government Form",
    entry_document: "Entry Document", other: "Other",
  };

  const formatSteps = (text) => {
    if (!text) return null;
    const steps = text.split(/(?=Step \d+:)/);
    return steps.map(s => s.trim()).filter(Boolean);
  };
  const steps = formatSteps(item.description);

  return (
    <div style={{
      background: allDone ? "#f0fdf4" : C.card,
      border: `1.5px solid ${isOverdue ? C.danger : isUrgent ? C.warn : allDone ? "#4CAF50" : someDone ? "#4CAF5066" : C.border}`,
      borderRadius: 14, padding: 16, marginBottom: 10,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        {/* Main checkbox — checks/unchecks all pets */}
        <input type="checkbox" checked={allDone} ref={el => { if(el) el.indeterminate = someDone && !allDone; }}
          onChange={() => onToggleAll(item, !allDone)}
          style={{ width: 20, height: 20, marginTop: 2, accentColor: C.accent, cursor: "pointer", flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ fontWeight: 700, fontSize: 15, textDecoration: allDone ? "line-through" : "none", color: allDone ? C.muted : C.text }}>
              {item.title}
            </span>
            <Badge label={categoryLabels[item.category] || item.category} color={categoryColors[item.category] || C.muted} />
            {isOverdue && <Badge label="OVERDUE" color={C.danger} />}
            {isUrgent && !isOverdue && <Badge label={`${days}d left`} color={C.warn} />}
          </div>

          {/* Per-pet checkboxes */}
          {hasPets && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
              {tripPets.map(pet => {
                const done = petCompletions[pet.id] === true;
                return (
                  <button key={pet.id} onClick={() => onTogglePet(item, pet.id, !done)}
                    style={{
                      display: "flex", alignItems: "center", gap: 6,
                      background: done ? "#4CAF5020" : C.bg,
                      border: `1.5px solid ${done ? "#4CAF50" : C.border}`,
                      borderRadius: 20, padding: "5px 12px", cursor: "pointer",
                      fontSize: 13, fontWeight: 600,
                      color: done ? "#4CAF50" : C.sub,
                      transition: "all .15s"
                    }}>
                    <span style={{ fontSize: 15 }}>{done ? "✓" : "○"}</span>
                    {pet.photo_url
                      ? <img src={pet.photo_url} alt={pet.name} style={{ width: 20, height: 20, borderRadius: "50%", objectFit: "cover" }} />
                      : <span style={{ width: 20, height: 20, borderRadius: "50%", background: C.accent + "30", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: C.accent }}>{pet.name[0]}</span>
                    }
                    {pet.name}
                  </button>
                );
              })}
            </div>
          )}

          {/* Deadline */}
          {item.deadline_date && (
            <div style={{ background: C.bg, borderRadius: 8, padding: "6px 12px", fontSize: 12, color: C.sub, marginBottom: 8 }}>
              📅 Deadline: {fmt(item.deadline_date)}
            </div>
          )}

          {/* Notes warning */}
          {item.notes && <div style={{ fontSize: 12, color: C.warn, marginBottom: 8, fontWeight: 600 }}>⚠ {item.notes}</div>}

          {/* View Instructions */}
          {item.description && (
            <div style={{ marginBottom: 8 }}>
              <button onClick={() => setExpanded(e => !e)} style={{
                background: C.accentDim, border: `1px solid ${C.accent}44`, borderRadius: 8,
                padding: "6px 12px", fontSize: 12, fontWeight: 700, color: C.accent,
                cursor: "pointer", fontFamily: "'Nunito', sans-serif"
              }}>
                {expanded ? "▲ Hide Instructions" : "▼ View Instructions"}
              </button>
              {expanded && (
                <div style={{ marginTop: 10, background: C.bg, borderRadius: 10, padding: 14 }}>
                  {steps.map((step, i) => (
                    <div key={i} style={{ fontSize: 13, color: C.sub, lineHeight: 1.6, marginBottom: i < steps.length - 1 ? 10 : 0, display: "flex", gap: 8 }}>
                      <span style={{ fontWeight: 700, color: C.accent, flexShrink: 0 }}>{i + 1}.</span>
                      <span>{step.replace(/^Step \d+:\s*/, '')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Official source */}
          {item.source_url && (
            <div style={{ marginBottom: 8 }}>
              <a href={item.source_url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8,
                  padding: "6px 12px", fontSize: 12, fontWeight: 700, color: C.accent, cursor: "pointer"
                }}>
                  🔗 Official Source →
                </span>
              </a>
            </div>
          )}

          {/* Upload per pet */}
          {item.requires_document && !allDone && (
            <div>
              <input ref={fr} type="file" accept="image/*,.pdf" style={{ display: "none" }} onChange={e => onUpload(item, e.target.files[0])} />
              <Btn sm v="secondary" onClick={() => fr.current.click()}>📎 Upload Document</Btn>
            </div>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5, flexShrink: 0 }}>
          <button onClick={() => onEdit(item)}
            style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "5px 8px", color: C.sub, cursor: "pointer" }}>✏️</button>
          <button onClick={() => onDelete(item.id)}
            style={{ background: C.dangerDim, border: `1px solid ${C.danger}44`, borderRadius: 8, padding: "5px 8px", color: C.danger, cursor: "pointer" }}>🗑</button>
        </div>
      </div>
    </div>
  );
};


const EditChecklistItemModal = ({ item, onSave, onClose }) => {
  const [f, setF] = useState({
    title: item.title || "", description: item.description || "", category: item.category || "other",
    deadline_date: item.deadline_date || "", deadline_window_start: item.deadline_window_start || "",
    deadline_window_end: item.deadline_window_end || "", notes: item.notes || "", requires_document: !!item.requires_document,
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const categoryLabels = {
    health_certificate: "Health Certificate", vaccination: "Vaccination", treatment: "Treatment",
    documentation: "Documentation", airline: "Airline", government_form: "Government Form",
    entry_document: "Entry Document", other: "Other",
  };
  const save = async () => {
    if (!f.title.trim()) return;
    setSaving(true);
    const { data, error } = await supabase.from('trip_checklist_items').update({
      title: f.title.trim(), description: f.description || null, category: f.category,
      deadline_date: f.deadline_date || null, deadline_window_start: f.deadline_window_start || null,
      deadline_window_end: f.deadline_window_end || null, notes: f.notes || null, requires_document: f.requires_document,
    }).eq('id', item.id).select().single();
    setSaving(false);
    if (error) { console.error('Checklist item update failed:', error); return; }
    onSave(data);
  };
  return (
    <Modal title="Edit Checklist Item" onClose={onClose}>
      <Field label="Title"><input maxLength={200} style={inp} value={f.title} onChange={e => set("title", e.target.value)} /></Field>
      <Field label="Description / Instructions"><textarea maxLength={2000} style={{ ...inp, minHeight: 90 }} value={f.description} onChange={e => set("description", e.target.value)} /></Field>
      <Field label="Category">
        <select style={inp} value={f.category} onChange={e => set("category", e.target.value)}>
          {Object.entries(categoryLabels).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <Field label="Deadline"><input type="date" style={inp} value={f.deadline_date} onChange={e => set("deadline_date", e.target.value)} /></Field>
        <Field label="Window Start"><input type="date" style={inp} value={f.deadline_window_start} onChange={e => set("deadline_window_start", e.target.value)} /></Field>
        <Field label="Window End"><input type="date" style={inp} value={f.deadline_window_end} onChange={e => set("deadline_window_end", e.target.value)} /></Field>
      </div>
      <Field label="Notes"><textarea maxLength={1000} style={{ ...inp, minHeight: 60 }} value={f.notes} onChange={e => set("notes", e.target.value)} /></Field>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: C.text, margin: "10px 0" }}>
        <input type="checkbox" checked={f.requires_document} onChange={e => set("requires_document", e.target.checked)} />
        Requires a document upload
      </label>
      <Btn full onClick={save} disabled={saving || !f.title.trim()}>{saving ? "Saving..." : "Save Changes"}</Btn>
    </Modal>
  );
};

const AirportReliefButton = ({ code }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const lookup = async () => {
    setLoading(true); setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/airport-relief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify({ airportCode: code }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || 'Could not look this up right now.');
      setData(json.data);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  if (!data) {
    return (
      <div style={{ marginTop: 6 }}>
        <button onClick={lookup} disabled={loading} type="button"
          style={{ background: C.accentDim, border: `1px solid ${C.accent}44`, borderRadius: 8, padding: "6px 12px", color: C.accent, fontSize: 12, fontWeight: 700, cursor: loading ? "default" : "pointer" }}>
          {loading ? "Looking up..." : `🐾 Find pet relief areas at ${code}`}
        </button>
        {error && <div style={{ fontSize: 12, color: C.danger, marginTop: 4 }}>{error}</div>}
      </div>
    );
  }
  return (
    <div style={{ marginTop: 8, background: C.bg, borderRadius: 10, padding: 12, border: `1px solid ${C.border}` }}>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>🐾 {data.airportName || code} — Pet Relief Areas</div>
      {(!data.areas || data.areas.length === 0)
        ? <div style={{ fontSize: 12, color: C.muted }}>No confirmed relief area info found for this airport yet.</div>
        : data.areas.map((a, i) => (
          <div key={i} style={{ fontSize: 12, color: C.text, marginBottom: 6 }}>
            <span style={{ fontWeight: 600 }}>{a.location}</span>{a.terminal ? ` (${a.terminal})` : ""}
            <div style={{ color: C.muted }}>{a.type === "indoor" ? "🏢 Indoor" : "🌳 Outdoor"}{a.notes ? ` · ${a.notes}` : ""}</div>
          </div>
        ))}
      {data.summary && <div style={{ fontSize: 12, color: C.muted, marginTop: 4, fontStyle: "italic" }}>{data.summary}</div>}
    </div>
  );
};

const TripDetail = ({ trip, userId, dogs, onBack, onUpdate, onDelete, onEdit, onDuplicate }) => {
  const [checklist, setChecklist] = useState([]);
  const [legs, setLegs] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState(null);
  const [buyingCredits, setBuyingCredits] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [checklistView, setChecklistView] = useState("list");
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [showUploadEntry, setShowUploadEntry] = useState(false);
  const [newItem, setNewItem] = useState({ title: "", description: "", category: "other", deadline_date: "", notes: "" });
  const [entryDoc, setEntryDoc] = useState({ name: "", notes: "", file: null });
  const fr = useRef();
  const cameraRef = useRef();

  const tripPets = dogs.filter(d => (trip.pet_ids || []).includes(d.id));
  const st = tripStatus(trip);
  const completed = checklist.filter(i => i.is_completed).length;
  const overdueCount = checklist.filter(i => !i.is_completed && daysUntil(i.deadline_date) !== null && daysUntil(i.deadline_date) < 0).length;
  const urgentCount = checklist.filter(i => !i.is_completed && daysUntil(i.deadline_date) !== null && daysUntil(i.deadline_date) >= 0 && daysUntil(i.deadline_date) <= 7).length;

  const cancelTrip = async () => {
    setCancelling(true);
    const { data, error } = await supabase.from('trips').update({ status: 'cancelled' }).eq('id', trip.id).select().single();
    setCancelling(false);
    if (error) { console.error('Cancel trip failed:', error); setGenError({ message: 'Could not cancel this trip — please try again.' }); return; }
    setShowMenu(false);
    onUpdate(data);
  };
  const reactivateTrip = async () => {
    setCancelling(true);
    const { data, error } = await supabase.from('trips').update({ status: 'planning' }).eq('id', trip.id).select().single();
    setCancelling(false);
    if (error) { console.error('Reactivate trip failed:', error); return; }
    setShowMenu(false);
    onUpdate(data);
  };

  useEffect(() => { loadData(); }, [trip.id]);

  const loadData = async () => {
    setLoading(true);
    const [{ data: cl }, { data: docs }, { data: legsData }] = await Promise.all([
      supabase.from('trip_checklist_items').select('*').eq('trip_id', trip.id).order('sort_order'),
      supabase.from('trip_documents').select('*').eq('trip_id', trip.id).order('created_at', { ascending: false }),
      supabase.from('trip_legs').select('*').eq('trip_id', trip.id).order('leg_order'),
    ]);
    setChecklist(cl || []);
    setDocuments(docs || []);
    setLegs(legsData || []);
    setLoading(false);
  };

  const generateRequirements = async () => {
    setGenerating(true); setGenError(null);
    try {
      // Multi-leg trips generate ONE checklist covering the real origin
      // (where the pet's paperwork starts) and the real final destination
      // (where it actually needs to be let in) -- exactly like a
      // single-leg trip. Layover/connection legs never get their own
      // entry-document research; a pure connection isn't somewhere the pet
      // is being imported into, and treating it that way produced
      // confusing, duplicate USA-entry-style items for what's really just
      // a plane change. trips.origin_city/destination_city/departure_date
      // already correctly represent the first leg's origin, the last leg's
      // destination, and the first leg's departure date (see TripForm),
      // so this is identical to the pre-multi-leg behavior. A layover leg's
      // only role in the app is the pet relief area lookup on its
      // Itinerary card, which is unaffected by this.
      const items = await generateChecklist(trip, tripPets, userId);
      const tripSpecies = new Set(tripPets.map(p => p.species || 'dog'));
      const filteredItems = items.filter(item => tripSpecies.has(item.applies_to || 'dog'));

      const daysToDateFrom = (departureDateStr, days) => {
        if (!days && days !== 0) return null;
        const depDate = new Date(departureDateStr + 'T12:00:00');
        const d = new Date(depDate.getTime() - days * 86400000);
        return d.toISOString().slice(0, 10);
      };

      const now = new Date().toISOString();
      const toInsert = filteredItems.map((item, i) => ({
        trip_id: trip.id, user_id: userId, leg_id: null,
        title: item.title || 'Requirement',
        description: item.description || null,
        category: item.category || 'other',
        deadline_date: item.deadline_days_before ? daysToDateFrom(trip.departure_date, item.deadline_days_before) : null,
        deadline_window_start: item.window_start_days ? daysToDateFrom(trip.departure_date, item.window_start_days) : null,
        deadline_window_end: item.window_end_days ? daysToDateFrom(trip.departure_date, item.window_end_days) : null,
        requires_document: item.requires_document === true,
        source_url: item.source_url || null,
        researched_at: now,
        notes: item.notes || null,
        sort_order: i,
      }));
      const { data, error: insertErr } = await supabase.from('trip_checklist_items').insert(toInsert).select();
      if (insertErr) { console.error('Checklist save failed:', insertErr); setGenError({ message: 'The checklist was generated but could not be saved — please try again.' }); setGenerating(false); return; }
      if (data) {
        setChecklist(prev => [...prev, ...data]);
        logActivity(userId, null, 'checklist_generated', { origin: trip.origin_city, destination: trip.destination_city, itemCount: data.length });
        // Send confirmation email with current usage, best-effort
        supabase.auth.getUser().then(async ({ data: userData }) => {
          const email = userData?.user?.email;
          if (!email) return;
          const { data: prof } = await supabase.from('profiles').select('ai_travel_limit_override, travel_credits_balance').eq('id', userId).single();
          const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
          const { count } = await supabase.from('ai_usage_log').select('id', { count: 'exact', head: true })
            .eq('user_id', userId).eq('feature', 'travel_checklist').eq('success', true).gte('created_at', monthStart.toISOString());
          fetch('/api/notify-user-action', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              actionType: 'checklist_generated', recipientEmail: email,
              data: {
                origin: trip.origin_city, destination: trip.destination_city,
                used: count || 0,
                limit: prof?.ai_travel_limit_override ?? 3,
                creditsBalance: prof?.travel_credits_balance || 0,
              },
            }),
          }).catch(() => {});
        });
      }
    } catch (e) {
      setGenError(e);
      logError(userId, null, "travel_checklist", e.message || "Unknown error");
    }
    setGenerating(false);
  };

  const togglePet = async (item, petId, done) => {
    const current = item.pet_completions || {};
    const updated = { ...current, [petId]: done };
    const allDone = tripPets.every(p => updated[p.id] === true);
    const { data, error } = await supabase.from('trip_checklist_items')
      .update({
        pet_completions: updated,
        is_completed: allDone,
        completed_date: allDone ? today() : null
      })
      .eq('id', item.id).select().single();
    if (error) { console.error('Toggle pet failed:', error); setGenError({ message: 'Could not update — please try again.' }); return; }
    if (data) setChecklist(prev => prev.map(x => x.id === item.id ? data : x));
  };

  const toggleAll = async (item, done) => {
    const updated = {};
    tripPets.forEach(p => updated[p.id] = done);
    const { data, error } = await supabase.from('trip_checklist_items')
      .update({
        pet_completions: updated,
        is_completed: done,
        completed_date: done ? today() : null
      })
      .eq('id', item.id).select().single();
    if (error) { console.error('Toggle all failed:', error); setGenError({ message: 'Could not update — please try again.' }); return; }
    if (data) setChecklist(prev => prev.map(x => x.id === item.id ? data : x));
  };

  // Legacy single toggle (no pets on trip)
  const toggleItem = async (item) => {
    if (tripPets.length > 0) {
      toggleAll(item, !item.is_completed);
      return;
    }
    const { data, error } = await supabase.from('trip_checklist_items')
      .update({ is_completed: !item.is_completed, completed_date: !item.is_completed ? today() : null })
      .eq('id', item.id).select().single();
    if (error) { console.error('Toggle item failed:', error); setGenError({ message: 'Could not update — please try again.' }); return; }
    if (data) setChecklist(prev => prev.map(x => x.id === item.id ? data : x));
  };

  const uploadDoc = async (item, file) => {
    if (!file) return;
    const path = `${userId}/trips/${trip.id}/${item.id}_${file.name}`;
    const { error: uploadErr } = await supabase.storage.from('documents').upload(path, file, { upsert: true });
    if (uploadErr) { console.error('Document upload failed:', uploadErr); setGenError({ message: 'Could not upload that file — please try again.' }); return; }
    const { data, error } = await supabase.from('trip_documents').insert({
      trip_id: trip.id, user_id: userId, checklist_item_id: item.id,
      name: `${item.title} — ${file.name}`, doc_date: today(),
      file_path: path, is_entry_document: false,
    }).select().single();
    if (error) { console.error('Document record save failed:', error); setGenError({ message: 'File uploaded but could not be saved to this item — please try again.' }); return; }
    if (data) { setDocuments(prev => [...prev, data]); await toggleItem(item); }
  };

  const deleteItem = async (id) => {
    const { error } = await supabase.from('trip_checklist_items').delete().eq('id', id);
    if (error) { console.error('Delete item failed:', error); setGenError({ message: 'Could not delete that item — please try again.' }); return; }
    setChecklist(prev => prev.filter(x => x.id !== id));
  };

  const addManualItem = async () => {
    if (!newItem.title) return;
    const { data, error } = await supabase.from('trip_checklist_items').insert({
      trip_id: trip.id, user_id: userId, ...newItem, sort_order: checklist.length,
    }).select().single();
    if (error) { console.error('Add manual item failed:', error); setGenError({ message: 'Could not add that item — please try again.' }); return; }
    if (data) { setChecklist(prev => [...prev, data]); setShowAddItem(false); setNewItem({ title: "", description: "", category: "other", deadline_date: "", notes: "" }); }
  };

  const uploadEntryDoc = async () => {
    if (!entryDoc.name) return;
    let path = null;
    if (entryDoc.file) {
      path = `${userId}/trips/${trip.id}/entry_${entryDoc.file.name}`;
      const { error: uploadErr } = await supabase.storage.from('documents').upload(path, entryDoc.file, { upsert: true });
      if (uploadErr) { console.error('Entry document upload failed:', uploadErr); setGenError({ message: 'Could not upload that file — please try again.' }); return; }
    }
    const { data, error } = await supabase.from('trip_documents').insert({
      trip_id: trip.id, user_id: userId, name: entryDoc.name,
      notes: entryDoc.notes, doc_date: today(), file_path: path, is_entry_document: true,
    }).select().single();
    if (error) { console.error('Entry document save failed:', error); setGenError({ message: 'Could not save this document — please try again.' }); return; }
    if (data) { setDocuments(prev => [...prev, data]); setShowUploadEntry(false); setEntryDoc({ name: "", notes: "", file: null }); }
  };

  const exportAllDocs = () => {
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Travel Documents — ${trip.name || trip.origin_city + ' to ' + trip.destination_city}</title>
<style>body{font-family:Georgia,serif;max-width:720px;margin:40px auto;padding:0 24px;color:#111}
h1{font-size:26px;margin-bottom:4px}.gen{color:#666;font-size:13px;margin-bottom:32px}
h2{font-size:14px;font-weight:700;text-transform:uppercase;border-bottom:2px solid #111;padding-bottom:6px;margin:28px 0 14px}
table{width:100%;border-collapse:collapse;font-size:13px}th{background:#f2f2f2;padding:8px 10px;text-align:left}
td{padding:8px 10px;border-bottom:1px solid #e8e8e8;vertical-align:top}
.done{color:#065f46;background:#d1fae5;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700}
.pending{color:#92400e;background:#fef3c7;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700}
footer{margin-top:48px;color:#aaa;font-size:12px;border-top:1px solid #eee;padding-top:16px}
@media print{body{margin:16px}}</style></head><body>
<h1>🛂 Travel Documents</h1>
<div class="gen">${trip.name || ''} · ${trip.origin_city}, ${trip.origin_country} → ${trip.destination_city}, ${trip.destination_country} · Departure: ${fmt(trip.departure_date)} · Generated ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} · YourPetPass</div>
<h2>Traveling Pets</h2>
<p>${tripPets.map(p => `${p.name} (${p.breed || 'Mixed'}${p.is_service_animal ? ', Service Animal' : ''}${p.is_esa ? ', ESA' : ''})`).join(', ') || '—'}</p>
<h2>Requirements Checklist</h2>
<table><tr><th>Requirement</th><th>Category</th><th>Status</th><th>Source</th></tr>
${checklist.map(i => `<tr><td><b>${i.title}</b>${i.description ? '<br><small>' + i.description + '</small>' : ''}</td><td>${i.category || '—'}</td><td><span class="${i.is_completed ? 'done' : 'pending'}">${i.is_completed ? '✓ Complete' : 'Pending'}</span></td><td>${i.source_name ? `<a href="${i.source_url}">${i.source_name}</a>` : '—'}${i.researched_at ? '<br><small>Checked ' + new Date(i.researched_at).toLocaleDateString() + '</small>' : ''}</td></tr>`).join('')}
</table>
${documents.length ? `<h2>Uploaded Documents</h2><table><tr><th>Document</th><th>Date</th><th>Type</th></tr>
${documents.map(d => `<tr><td>${d.name}</td><td>${fmt(d.doc_date)}</td><td>${d.is_entry_document ? 'Entry Document' : 'Travel Document'}</td></tr>`).join('')}</table>` : ''}
<footer>Generated by YourPetPass · Always verify requirements with official sources before travel.</footer></body></html>`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    a.download = `${(trip.name || trip.origin_city + '_to_' + trip.destination_city).replace(/\s+/g, '_')}_TravelDocs.html`;
    a.click();
  };

  const categories = ["health_certificate", "vaccination", "treatment", "documentation", "airline", "government_form", "entry_document", "other"];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, paddingBottom: 40 }}>
      <div style={{ background: C.accentDark, padding: "16px 20px", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 680, margin: "0 auto", display: "flex", alignItems: "center", gap: 12, position: "relative" }}>
          <button onClick={onBack} style={{ background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 10, padding: "8px 12px", color: "#fff", cursor: "pointer", fontSize: 16 }}>←</button>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Lora', serif", fontSize: 20, color: "#fff", fontWeight: 600 }}>
              {legs.length > 1 ? legs.map(l => l.origin_city).concat(legs[legs.length-1]?.destination_city).join(" → ") : `${trip.origin_city} → ${trip.destination_city}`}
            </div>
            <div style={{ color: "#F5C45E", fontSize: 13, marginTop: 2 }}>{fmt(trip.departure_date)}{trip.return_date ? ` · Return ${fmt(trip.return_date)}` : ""}{legs.length > 1 ? ` · ${legs.length} legs` : ""}</div>
          </div>
          <Badge label={st.label} color={st.color} />
          <button onClick={() => setShowMenu(s => !s)} title="Trip options" style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 10, padding: "8px 10px", color: "#fff", cursor: "pointer" }}>⋯</button>
          {showMenu && (
            <>
              <div onClick={() => setShowMenu(false)} style={{ position: "fixed", inset: 0, zIndex: 998 }} />
              <div style={{ position: "absolute", top: 44, right: 0, background: "#FFFFFF", borderRadius: 14, boxShadow: "0 8px 24px rgba(44,32,23,0.2)", zIndex: 999, minWidth: 190, overflow: "hidden", border: "1px solid #E8DDD0" }}>
                <button onClick={() => { setShowMenu(false); onEdit(trip); }} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "12px 16px", background: "none", border: "none", textAlign: "left", cursor: "pointer", fontSize: 14, color: "#2C2017" }}>✏️ Edit Trip</button>
                <button onClick={() => { setShowMenu(false); onDuplicate(trip); }} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "12px 16px", background: "none", border: "none", textAlign: "left", cursor: "pointer", fontSize: 14, color: "#2C2017", borderTop: "1px solid #F0E8DC" }}>📋 Duplicate Trip</button>
                {trip.status === 'cancelled'
                  ? <button onClick={reactivateTrip} disabled={cancelling} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "12px 16px", background: "none", border: "none", textAlign: "left", cursor: "pointer", fontSize: 14, color: "#2D7D6F", borderTop: "1px solid #F0E8DC" }}>↩️ Reactivate Trip</button>
                  : <button onClick={cancelTrip} disabled={cancelling} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "12px 16px", background: "none", border: "none", textAlign: "left", cursor: "pointer", fontSize: 14, color: "#E8A838", borderTop: "1px solid #F0E8DC" }}>🚫 Cancel Trip</button>}
                <button onClick={() => { setShowMenu(false); setShowDeleteConfirm(true); }} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "12px 16px", background: "none", border: "none", textAlign: "left", cursor: "pointer", fontSize: 14, color: "#C4714A", borderTop: "1px solid #F0E8DC" }}>🗑️ Delete Permanently</button>
              </div>
            </>
          )}
        </div>
      </div>

      {showDeleteConfirm && (
        <div onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(""); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#FFFFFF", borderRadius: 18, padding: 28, maxWidth: 400, width: "100%" }}>
            <div style={{ fontFamily: "'Lora', serif", fontSize: 19, color: "#C4714A", marginBottom: 10 }}>Delete this trip?</div>
            <div style={{ fontSize: 14, color: "#5A4535", lineHeight: 1.6, marginBottom: 16 }}>
              This will permanently delete the trip "<strong>{trip.origin_city} → {trip.destination_city}</strong>" along with its entire checklist and uploaded documents. This cannot be undone.
            </div>
            <div style={{ fontSize: 13, color: "#5A4535", marginBottom: 8 }}>
              Type <strong>{trip.origin_city}</strong> to confirm:
            </div>
            <input maxLength={150}
              value={deleteConfirmText}
              onChange={e => setDeleteConfirmText(e.target.value)}
              placeholder={trip.origin_city}
              style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: "1.5px solid #E8DDD0", background: "#FAF6F0", color: "#2C2017", fontSize: 15, marginBottom: 16, boxSizing: "border-box" }}
            />
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(""); }} style={{ flex: 1, background: "transparent", border: "1px solid #E8DDD0", borderRadius: 10, padding: 12, color: "#5A4535", cursor: "pointer", fontWeight: 600 }}>Cancel</button>
              <button
                onClick={async () => {
                  setDeleting(true);
                  // trip_checklist_items and trip_documents both already
                  // cascade from trips(id) -- deleting the trip is enough.
                  const { error } = await supabase.from('trips').delete().eq('id', trip.id);
                  setDeleting(false);
                  if (error) {
                    console.error('Trip delete failed:', error);
                    setGenError({ message: 'Could not fully delete this trip — please try again, or contact support if it keeps happening.' });
                    return;
                  }
                  setShowDeleteConfirm(false);
                  onDelete(trip.id);
                }}
                disabled={deleteConfirmText !== trip.origin_city || deleting}
                style={{ flex: 1, background: deleteConfirmText === trip.origin_city ? "#C4714A" : "#E8DDD0", border: "none", borderRadius: 10, padding: 12, color: "#fff", cursor: deleteConfirmText === trip.origin_city ? "pointer" : "not-allowed", fontWeight: 700 }}>
                {deleting ? "Deleting..." : "Delete Trip"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "20px 16px" }}>
        {legs.length > 0 && (
          <Card style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 12 }}>{legs.length > 1 ? `Itinerary (${legs.length} legs)` : "Itinerary"}</div>
            {legs.map((leg, i) => (
              <div key={leg.id} style={{ paddingBottom: i < legs.length - 1 ? 14 : 0, marginBottom: i < legs.length - 1 ? 14 : 0, borderBottom: i < legs.length - 1 ? `1px solid ${C.border}` : "none" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>
                    {legs.length > 1 && <span style={{ color: C.muted, fontWeight: 700, marginRight: 6 }}>Leg {i + 1}:</span>}
                    {leg.origin_city} → {leg.destination_city}
                  </div>
                  <div style={{ fontSize: 12, color: C.muted }}>{fmt(leg.departure_date)}</div>
                </div>
                {(leg.airline || leg.flight_number) && (
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{leg.airline}{leg.flight_number ? ` · ${leg.flight_number}` : ""}</div>
                )}
                {leg.transportation_type === "air" && (leg.origin_airport_code || leg.destination_airport_code) && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {leg.origin_airport_code && <AirportReliefButton code={leg.origin_airport_code} />}
                    {leg.destination_airport_code && leg.destination_airport_code !== leg.origin_airport_code && <AirportReliefButton code={leg.destination_airport_code} />}
                  </div>
                )}
              </div>
            ))}
          </Card>
        )}

        {checklist.length > 0 && (
          <Card style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontWeight: 700 }}>Checklist Progress</div>
              <div style={{ display: "flex", gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#5A4535", background: "#FAF6F0", borderRadius: 20, padding: "3px 10px" }}>{completed}/{checklist.length} done</span>
                {overdueCount > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: "#fff", background: C.danger, borderRadius: 20, padding: "3px 10px" }}>{overdueCount} overdue</span>}
                {urgentCount > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: "#2C2017", background: C.warn, borderRadius: 20, padding: "3px 10px" }}>{urgentCount} due soon</span>}
              </div>
            </div>
            {tripPets.length > 1 ? (
              // Multiple pets — show one progress bar per pet, since each pet
              // needs their own documents completed (e.g. separate health certificates).
              tripPets.map(pet => {
                const relevantItems = checklist.filter(i => (i.applies_to || 'dog') === (pet.species || 'dog'));
                const petDone = relevantItems.filter(i => (i.pet_completions || {})[pet.id] === true).length;
                const petTotal = relevantItems.length;
                const petAllDone = petTotal > 0 && petDone === petTotal;
                return (
                  <div key={pet.id} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{pet.species === 'cat' ? '🐈' : '🐕'} {pet.name}</span>
                      <span style={{ fontWeight: 800, fontSize: 13, color: petAllDone ? "#4CAF50" : C.accent }}>{petDone}/{petTotal} complete</span>
                    </div>
                    <div style={{ background: C.border, borderRadius: 20, height: 7, overflow: "hidden" }}>
                      <div style={{ background: petAllDone ? "#4CAF50" : C.accent, height: "100%", borderRadius: 20, width: `${petTotal > 0 ? (petDone / petTotal) * 100 : 0}%`, transition: "width .3s" }} />
                    </div>
                  </div>
                );
              })
            ) : (
              // Single pet — keep the simple aggregate bar
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <span style={{ fontWeight: 700 }}>&nbsp;</span>
                  <span style={{ fontWeight: 800, color: completed === checklist.length ? "#4CAF50" : C.accent }}>{completed}/{checklist.length} complete</span>
                </div>
                <div style={{ background: C.border, borderRadius: 20, height: 8, overflow: "hidden" }}>
                  <div style={{ background: completed === checklist.length ? "#4CAF50" : C.accent, height: "100%", borderRadius: 20, width: `${checklist.length > 0 ? (completed / checklist.length) * 100 : 0}%`, transition: "width .3s" }} />
                </div>
              </>
            )}
          </Card>
        )}

        {tripPets.length > 0 && (
          <Card style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 800, fontSize: 12, color: C.sub, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10 }}>🐾 Traveling Pets</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {tripPets.map(p => (
                <div key={p.id} style={{ background: C.bg, borderRadius: 10, padding: "6px 12px", fontSize: 14, fontWeight: 600 }}>
                  {p.name}
                  {p.is_service_animal && <span style={{ color: C.accent, fontSize: 11, marginLeft: 6 }}>Service Animal</span>}
                  {p.is_esa && <span style={{ color: C.warn, fontSize: 11, marginLeft: 6 }}>ESA</span>}
                </div>
              ))}
            </div>
          </Card>
        )}

        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ fontFamily: "'Lora', serif", fontSize: 20, color: C.text }}>Requirements Checklist</h3>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn sm v="secondary" onClick={() => setShowAddItem(true)}>+ Add</Btn>
              {checklist.length === 0 && (
                <Btn sm onClick={generateRequirements} disabled={generating} style={{ background: C.warn, color: "#2C2017" }}>
                  {generating ? "Researching..." : "🤖 AI Generate"}
                </Btn>
              )}
              {checklist.length > 0 && (
                <Btn sm onClick={generateRequirements} disabled={generating} v="secondary">
                  {generating ? "..." : "🔄 Refresh"}
                </Btn>
              )}
            </div>
          </div>

          {genError && (
            <div style={{ background: C.dangerDim, border: `1px solid ${C.danger}44`, borderRadius: 12, padding: 14, marginBottom: 12 }}>
              <div style={{ fontSize: 13, color: C.danger, marginBottom: genError.rateLimitExceeded ? 10 : 0 }}>
                ⚠ {genError.message}{!genError.rateLimitExceeded && ". Try again or add requirements manually."}
              </div>
              {genError.rateLimitExceeded && (
                <button
                  onClick={async () => {
                    setBuyingCredits(true);
                    try {
                      const res = await fetch('/api/create-checkout', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          priceId: TRAVEL_CREDIT_PACK_PRICE_ID,
                          userId,
                          mode: 'payment',
                          purchaseType: 'travel_credits',
                          creditAmount: 3,
                        }),
                      });
                      const data = await res.json();
                      if (!res.ok || data.error) throw new Error(data.error || 'Could not start checkout');
                      window.location.href = data.url;
                    } catch (e) {
                      setGenError({ message: e.message });
                    }
                    setBuyingCredits(false);
                  }}
                  disabled={buyingCredits}
                  style={{ background: '#E8A838', color: '#1E1408', border: 'none', borderRadius: 10, padding: '10px 18px', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: "'Nunito', sans-serif" }}>
                  {buyingCredits ? 'Loading...' : '🎫 Buy 3 More Checklists — $2.99'}
                </button>
              )}
            </div>
          )}

          {generating && (
            <Card style={{ textAlign: "center", padding: 32 }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🔍</div>
              <div style={{ fontFamily: "'Lora', serif", fontSize: 18, marginBottom: 6 }}>Researching Requirements...</div>
              <div style={{ color: C.muted, fontSize: 14 }}>AI is checking requirements for {trip.origin_city} → {trip.destination_city}</div>
            </Card>
          )}

          {!generating && checklist.length === 0 && (
            <Card style={{ textAlign: "center", padding: 32, borderStyle: "dashed" }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🛂</div>
              <div style={{ fontFamily: "'Lora', serif", fontSize: 18, marginBottom: 6 }}>No requirements yet</div>
              <div style={{ color: C.muted, fontSize: 14, marginBottom: 20 }}>Let AI research the requirements for this route, or add them manually</div>
              <Btn onClick={generateRequirements} style={{ margin: "0 auto", background: C.warn, color: "#2C2017" }}>🤖 Generate Requirements with AI</Btn>
            </Card>
          )}

          {checklist.length > 0 && (
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              {["list", "timeline"].map(v => (
                <button key={v} onClick={() => setChecklistView(v)} type="button" style={{
                  background: checklistView === v ? C.accent : "#fff", color: checklistView === v ? "#fff" : C.sub,
                  border: `1px solid ${checklistView === v ? C.accent : C.border}`, borderRadius: 20,
                  padding: "6px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer",
                }}>
                  {v === "list" ? "📋 Checklist" : "🗓️ Timeline"}
                </button>
              ))}
            </div>
          )}

          {checklistView === "timeline" && checklist.length > 0
            ? <ChecklistTimeline checklist={checklist} onEdit={setEditingItem} />
            : checklist.map(item => (
              <ChecklistItem key={item.id} item={item} tripPets={tripPets} onTogglePet={togglePet} onToggleAll={toggleAll} onUpload={uploadDoc} onDelete={deleteItem} onEdit={setEditingItem} />
            ))}
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ fontFamily: "'Lora', serif", fontSize: 20, color: C.text }}>Documents</h3>
            <Btn sm v="secondary" onClick={() => setShowUploadEntry(true)}>📎 Upload Entry Doc</Btn>
          </div>
          {documents.length === 0
            ? <Card style={{ textAlign: "center", padding: 24, borderStyle: "dashed", color: C.muted }}>No documents uploaded yet.</Card>
            : documents.map(d => (
              <Card key={d.id} style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{d.name}</div>
                    <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{fmt(d.doc_date)} · {d.is_entry_document ? "📋 Entry Document" : "📄 Travel Document"}</div>
                    {d.notes && <div style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>{d.notes}</div>}
                  </div>
                  <button onClick={async () => { await supabase.from('trip_documents').delete().eq('id', d.id); setDocuments(prev => prev.filter(x => x.id !== d.id)); }}
                    style={{ background: C.dangerDim, border: `1px solid ${C.danger}44`, borderRadius: 8, padding: "5px 8px", color: C.danger, cursor: "pointer" }}>🗑</button>
                </div>
              </Card>
            ))}
        </div>

        {(checklist.length > 0 || documents.length > 0) && (
          <Btn full onClick={exportAllDocs} style={{ background: C.accentDark, color: "#fff", justifyContent: "center" }}>📥 Export All Travel Documents</Btn>
        )}
      </div>

      {editingItem && (
        <EditChecklistItemModal item={editingItem}
          onSave={updated => { setChecklist(prev => prev.map(i => i.id === updated.id ? updated : i)); setEditingItem(null); }}
          onClose={() => setEditingItem(null)} />
      )}
      {showAddItem && (
        <Modal title="Add Requirement" onClose={() => setShowAddItem(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Field label="Title"><input maxLength={150} style={inp} value={newItem.title} onChange={e => setNewItem(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Health Certificate" /></Field>
            <Field label="Category">
              <select style={inp} value={newItem.category} onChange={e => setNewItem(p => ({ ...p, category: e.target.value }))}>
                {categories.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
              </select>
            </Field>
            <Field label="Description"><textarea maxLength={1000} style={{ ...inp, minHeight: 60 }} value={newItem.description} onChange={e => setNewItem(p => ({ ...p, description: e.target.value }))} /></Field>
            <Field label="Deadline Date"><input style={inp} type="date" value={newItem.deadline_date} onChange={e => setNewItem(p => ({ ...p, deadline_date: e.target.value }))} /></Field>
            <Field label="Notes / Warnings"><input maxLength={150} style={inp} value={newItem.notes} onChange={e => setNewItem(p => ({ ...p, notes: e.target.value }))} /></Field>
            <div style={{ display: "flex", gap: 10 }}>
              <Btn v="secondary" onClick={() => setShowAddItem(false)} full>Cancel</Btn>
              <Btn onClick={addManualItem} full>Add Requirement</Btn>
            </div>
          </div>
        </Modal>
      )}

      {showUploadEntry && (
        <Modal title="Upload Entry Document" onClose={() => setShowUploadEntry(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <p style={{ color: C.sub, fontSize: 14 }}>Upload forms received on arrival — entry permits, import receipts, border stamps, etc.</p>
            <Field label="Document Name"><input maxLength={150} style={inp} value={entryDoc.name} onChange={e => setEntryDoc(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Panama Import Receipt" /></Field>
            <Field label="Notes"><input maxLength={150} style={inp} value={entryDoc.notes} onChange={e => setEntryDoc(p => ({ ...p, notes: e.target.value }))} /></Field>
            <input ref={fr} type="file" accept="image/*,.pdf" style={{ display: "none" }} onChange={e => setEntryDoc(p => ({ ...p, file: e.target.files[0] }))} />
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={e => setEntryDoc(p => ({ ...p, file: e.target.files[0] }))} />
            {entryDoc.file ? (
              <div style={{ border: `2px solid ${C.accent}`, borderRadius: 12, padding: 16, textAlign: "center", color: C.accent, fontWeight: 600 }}>
                ✓ {entryDoc.file.name}
                <button onClick={() => setEntryDoc(p => ({ ...p, file: null }))} style={{ display: "block", margin: "8px auto 0", background: "none", border: "none", color: C.sub, fontSize: 12, cursor: "pointer", textDecoration: "underline" }}>Remove</button>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                <button onClick={() => cameraRef.current.click()} style={{ background: `${C.accent}14`, color: C.accent, borderRadius: 10, padding: "14px 6px", fontWeight: 600, fontSize: 12, border: `1px solid ${C.accent}44`, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                  <span style={{ fontSize: 20 }}>📷</span>Take Photo
                </button>
                <button onClick={() => { fr.current.accept = "image/*"; fr.current.click(); }} style={{ background: C.bg, color: C.text, borderRadius: 10, padding: "14px 6px", fontWeight: 600, fontSize: 12, border: `1px solid ${C.border}`, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                  <span style={{ fontSize: 20 }}>🖼️</span>Photo Library
                </button>
                <button onClick={() => { fr.current.accept = "image/*,.pdf"; fr.current.click(); }} style={{ background: C.bg, color: C.text, borderRadius: 10, padding: "14px 6px", fontWeight: 600, fontSize: 12, border: `1px solid ${C.border}`, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                  <span style={{ fontSize: 20 }}>📁</span>Choose File
                </button>
              </div>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <Btn v="secondary" onClick={() => setShowUploadEntry(false)} full>Cancel</Btn>
              <Btn onClick={uploadEntryDoc} disabled={!entryDoc.name} full>Save Document</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ── TRAVEL DASHBOARD ─────────────────────────────────────
export default function Travel({ userId, onBack }) {
  const [dogs, setDogs] = useState([]);
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [editTrip, setEditTrip] = useState(null);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [filter, setFilter] = useState("upcoming");

  useEffect(() => { loadTrips(); loadDogs(); }, [userId]);

  const loadDogs = async () => {
    const { data, error } = await supabase.from("dogs").select("*").eq("user_id", userId).order("name");
    if (error) console.error('Failed to load pets:', error);
    setDogs(data || []);
  };

  const loadTrips = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('trips').select('*').eq('user_id', userId).order('departure_date');
    if (error) console.error('Failed to load trips:', error);
    setTrips(data || []);
    setLoading(false);
  };

  const duplicateTrip = async (trip) => {
    const { name, origin_city, origin_country, destination_city, destination_country,
      departure_date, return_date, transportation_type, airline, flight_number, notes, pet_ids } = trip;
    const { data: newTrip, error } = await supabase.from('trips').insert({
      user_id: userId,
      name: name ? `${name} (Copy)` : `${origin_city} → ${destination_city} (Copy)`,
      origin_city, origin_country, destination_city, destination_country,
      departure_date, return_date, transportation_type, airline, flight_number, notes, pet_ids,
      status: 'planning',
    }).select().single();
    if (error) { console.error('Duplicate trip failed:', error); return; }

    // Copy legs too, if the original trip has any (multi-leg itinerary).
    const { data: legs } = await supabase.from('trip_legs').select('*').eq('trip_id', trip.id).order('leg_order');
    if (legs && legs.length) {
      const newLegs = legs.map(l => ({
        trip_id: newTrip.id, user_id: userId, leg_order: l.leg_order,
        origin_city: l.origin_city, origin_country: l.origin_country, origin_airport_code: l.origin_airport_code,
        destination_city: l.destination_city, destination_country: l.destination_country, destination_airport_code: l.destination_airport_code,
        departure_date: l.departure_date, transportation_type: l.transportation_type,
        airline: l.airline, flight_number: l.flight_number, is_layover: l.is_layover,
      }));
      await supabase.from('trip_legs').insert(newLegs);
    }
    // Note: checklist items are intentionally NOT copied -- requirements
    // are date- and route-specific; the new trip should generate its own.
    setTrips(prev => [...prev, newTrip]);
    setEditTrip(newTrip); // open it in edit mode immediately so dates can be adjusted
  };

  if (selectedTrip) {
    const trip = trips.find(t => t.id === selectedTrip);
    if (trip) return (
      <TripDetail trip={trip} userId={userId} dogs={dogs}
        onBack={() => setSelectedTrip(null)}
        onUpdate={updated => { setTrips(prev => prev.map(t => t.id === updated.id ? updated : t)); }}
        onDelete={deletedId => { setTrips(prev => prev.filter(t => t.id !== deletedId)); setSelectedTrip(null); }}
        onEdit={setEditTrip}
        onDuplicate={duplicateTrip}
      />
    );
  }

  const now = new Date(); now.setHours(0, 0, 0, 0);
  const upcoming = trips.filter(t => new Date(t.departure_date) >= now && t.status !== 'cancelled');
  const past = trips.filter(t => new Date(t.departure_date) < now || t.status === 'completed');
  const displayed = filter === "upcoming" ? upcoming : past;

  const alerts = trips.filter(t => {
    if (t.status === 'completed' || t.status === 'cancelled') return false;
    const days = daysUntil(t.departure_date);
    return days !== null && days <= 14 && days >= 0;
  });

  return (
    <div style={{ minHeight: "100vh", background: C.bg }}>
      <div style={{ background: C.accentDark, padding: "20px 16px" }}>
        <div style={{ maxWidth: 680, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left" }}>
            <div style={{ fontFamily: "'Lora', serif", fontSize: 20, color: "#FFFFFF", fontWeight: 900, lineHeight: 1 }}>
              🐾 <span>Your</span><span style={{ color: "#F5C45E" }}>Pet</span><span>Pass</span>
            </div>
            <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, marginTop: 2, fontStyle: "italic" }}>← My Pets</div>
          </button>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: "'Lora', serif", fontSize: 22, color: "#fff", fontWeight: 600 }}>🛂 Travel Planner</div>
          </div>
          <Btn onClick={() => setShowNew(true)} style={{ background: C.warn, color: "#2C2017" }}>+ New Trip</Btn>
        </div>
      </div>

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "20px 16px" }}>
        {alerts.length > 0 && (
          <div style={{ background: C.warnDim, border: `1px solid ${C.warn}44`, borderRadius: 14, padding: 16, marginBottom: 16 }}>
            <div style={{ fontWeight: 700, color: C.warn, marginBottom: 8 }}>⚠ Upcoming Trip Alerts</div>
            {alerts.map(t => {
              const days = daysUntil(t.departure_date);
              return (
                <div key={t.id} style={{ fontSize: 14, color: C.text, cursor: "pointer", padding: "4px 0" }} onClick={() => setSelectedTrip(t.id)}>
                  <b>{t.origin_city} → {t.destination_city}</b> — {days === 0 ? "Today!" : `${days} days away`} →
                </div>
              );
            })}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {["upcoming", "past"].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              background: filter === f ? C.accent : C.card, color: filter === f ? "#fff" : C.sub,
              border: `1px solid ${filter === f ? C.accent : C.border}`, borderRadius: 20,
              padding: "7px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'Nunito', sans-serif"
            }}>
              {f === "upcoming" ? `Upcoming (${upcoming.length})` : `Past (${past.length})`}
            </button>
          ))}
        </div>

        {loading && <div style={{ textAlign: "center", padding: 40, color: C.muted }}>Loading trips...</div>}

        {!loading && displayed.length === 0 && (
          <div style={{ textAlign: "center", padding: "52px 20px" }}>
            <div style={{ fontSize: 48, marginBottom: 14 }}>✈️</div>
            <div style={{ fontFamily: "'Lora', serif", fontSize: 22, marginBottom: 6, fontStyle: "italic" }}>
              {filter === "upcoming" ? "No upcoming trips" : "No past trips"}
            </div>
            <div style={{ color: C.muted, fontSize: 14, marginBottom: 24 }}>
              {filter === "upcoming" ? "Plan your next adventure with your pet" : "Your completed trips will appear here"}
            </div>
            {filter === "upcoming" && (
              <Btn onClick={() => setShowNew(true)} style={{ margin: "0 auto", background: C.warn, color: "#2C2017" }}>+ Plan First Trip</Btn>
            )}
          </div>
        )}

        {displayed.map(trip => {
          const st = tripStatus(trip);
          const tripPets = dogs.filter(d => (trip.pet_ids || []).includes(d.id));
          return (
            <Card key={trip.id} onClick={() => setSelectedTrip(trip.id)} style={{ marginBottom: 12, cursor: "pointer" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "'Lora', serif", fontSize: 18, fontWeight: 600, marginBottom: 2 }}>
                    {trip.origin_city}, {trip.origin_country} → {trip.destination_city}, {trip.destination_country}
                  </div>
                  {trip.name && trip.name !== `${trip.origin_city} → ${trip.destination_city}` && (
                    <div style={{ fontSize: 13, color: C.muted, marginBottom: 4 }}>{trip.name}</div>
                  )}
                </div>
                <Badge label={st.label} color={st.color} />
              </div>
              {/* Trip details grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, background: "#FAF6F0", borderRadius: 10, padding: "10px 12px", fontSize: 12 }}>
                <div><span style={{ color: C.muted, fontWeight: 600 }}>Depart </span>{fmt(trip.departure_date)}</div>
                {trip.return_date && <div><span style={{ color: C.muted, fontWeight: 600 }}>Return </span>{fmt(trip.return_date)}</div>}
                <div><span style={{ color: C.muted, fontWeight: 600 }}>Traveling </span>{{air:"✈️ Flying",sea:"🚢 By Sea",land:"🚗 Driving",bus:"🚌 Bus"}[trip.transportation_type]||"✈️ Flying"}</div>
                {trip.airline && <div><span style={{ color: C.muted, fontWeight: 600 }}>{trip.transportation_type==="sea"?"Cruise/Ferry ":trip.transportation_type==="bus"?"Bus Co. ":"Airline "}</span>{trip.airline}</div>}
                {trip.flight_number && trip.transportation_type==="air" && <div><span style={{ color: C.muted, fontWeight: 600 }}>Flight </span>{trip.flight_number}</div>}
              </div>
              {tripPets.length > 0 && (
                <div style={{ fontSize: 13, color: C.muted, marginTop: 8 }}>🐾 {tripPets.map(p => p.name).join(", ")}</div>
              )}
              <div style={{ fontSize: 12, color: C.accent, marginTop: 8, fontWeight: 600 }}>Tap to view checklist →</div>
            </Card>
          );
        })}
      </div>

      {showNew && (
        <TripForm userId={userId} dogs={dogs}
          onSave={t => { setTrips(prev => [...prev, t]); setShowNew(false); setSelectedTrip(t.id); }}
          onClose={() => setShowNew(false)} />
      )}
      {editTrip && (
        <TripForm trip={editTrip} userId={userId} dogs={dogs}
          onSave={t => { setTrips(prev => prev.map(x => x.id === t.id ? t : x)); setEditTrip(null); }}
          onClose={() => setEditTrip(null)} />
      )}
      {/* Bottom nav — matches home screen */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#FFFFFF", borderTop: "1px solid #E8DDD0", display: "flex", zIndex: 200, paddingBottom: "env(safe-area-inset-bottom)" }}>
        <button onClick={onBack} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "10px 0", background: "none", border: "none", cursor: "pointer", color: "#8B7355" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8B7355" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".04em" }}>MY PETS</span>
        </button>
        <button style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "10px 0", background: "none", border: "none", cursor: "pointer", color: "#2D7D6F" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2D7D6F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20"/></svg>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".04em" }}>TRAVEL</span>
        </button>
      </div>
      <div style={{ height: 72 }} />
    </div>
  );
}
