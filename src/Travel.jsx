// TravelModule.jsx — YourPetPass Travel Feature
// Paste this entire file into GitHub as: src/Travel.jsx

import { useState, useEffect, useRef } from "react";
import { supabase } from "./lib/supabase";

// Stripe Price ID for the "3 extra travel checklists for $2.99" pack.
// Create this product in Stripe (live mode) and replace this placeholder.
const TRAVEL_CREDIT_PACK_PRICE_ID = "price_REPLACE_WITH_REAL_ID";

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
  const petList = pets.map(p =>
    `${p.name} (${p.breed || 'mixed'}${p.is_service_animal ? ', SERVICE ANIMAL' : ''}${p.is_esa ? ', ESA' : ''})`
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

  const prompt = `You are a veterinary travel compliance expert specializing in international pet travel documentation. Generate a COMPLETE, ACCURATE, and ACTIONABLE pet travel checklist for this route.

TRIP DETAILS:
- Origin: ${trip.origin_city}, ${trip.origin_country}
- Destination: ${trip.destination_city}, ${trip.destination_country}
- Departure Date: ${trip.departure_date}
- Airline: ${trip.airline || "not specified"}
- Pets: ${petList}

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

===== AIRLINE REQUIREMENTS =====
Always include a checklist item for ${trip.airline || "the airline"} with:
- Cabin vs cargo policy for pets
- Carrier/crate size and weight limits
- Whether breed restrictions apply (especially brachycephalic/snub-nosed breeds)
- How far in advance to book pet travel
- Pet fees
- Source: the airline's official pet policy page

===== OUTPUT FORMAT =====
Return ONLY a valid JSON array. No markdown, no backticks, no explanation text before or after.
Each item must have these exact fields:
- title: string (clear, specific title)
- description: string (step-by-step numbered instructions, include contacts, costs, timing)
- category: one of: health_certificate, vaccination, treatment, documentation, airline, government_form, entry_document, other
- deadline_days_before: number (days before USA departure date that this must be completed)
- window_start_days: number (how many days before travel the document becomes valid)
- window_end_days: number (0 means must be valid on travel day)
- requires_document: boolean
- source_url: string (official government or airline URL — never a blog or third party)
- notes: string (warnings, tips, common mistakes)

[`;

  const response = await fetch("/api/ai-travel", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages: [{ role: "user", content: prompt }],
      userId: userId,
      userEmail: null,
      destination: `${trip.origin_city} to ${trip.destination_city}`,
      originCountry: trip.origin_country,
      destinationCountry: trip.destination_country,
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
const TripForm = ({ trip, userId, dogs, onSave, onClose }) => {
  const [f, setF] = useState(trip ? {
    name: trip.name || "",
    originCity: trip.origin_city || "",
    originCountry: trip.origin_country || "United States",
    destinationCity: trip.destination_city || "",
    destinationCountry: trip.destination_country || "",
    departureDate: trip.departure_date || "",
    returnDate: trip.return_date || "",
    airline: trip.airline || "",
    notes: trip.notes || "",
    selectedPets: trip.pet_ids || [],
  } : {
    name: "", originCity: "", originCountry: "United States", destinationCity: "",
    destinationCountry: "", departureDate: "", returnDate: "",
    airline: "", notes: "", selectedPets: [],
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  const togglePet = (id) => {
    setF(p => ({
      ...p,
      selectedPets: p.selectedPets.includes(id)
        ? p.selectedPets.filter(x => x !== id)
        : [...p.selectedPets, id]
    }));
  };

  const save = async () => {
    if (!f.originCity || !f.destinationCity || !f.departureDate) return;
    setSaving(true);
    const payload = {
      user_id: userId,
      name: f.name || `${f.originCity} → ${f.destinationCity}`,
      origin_city: f.originCity, origin_country: f.originCountry,
      destination_city: f.destinationCity, destination_country: f.destinationCountry,
      departure_date: f.departureDate, return_date: f.returnDate || null,
      airline: f.airline, flight_number: f.flightNumber || null, notes: f.notes, pet_ids: f.selectedPets,
    };
    let result;
    if (trip) {
      const { data } = await supabase.from('trips').update(payload).eq('id', trip.id).select().single();
      result = data;
    } else {
      const { data } = await supabase.from('trips').insert(payload).select().single();
      result = data;
    }
    if (result) onSave(result);
    setSaving(false);
  };

  return (
    <Modal title={trip ? "Edit Trip" : "Plan New Trip"} onClose={onClose} wide>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Field label="Trip Name (optional)">
          <input style={inp} value={f.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Panama to Miami Summer 2026" />
        </Field>

        <div style={{ background: C.bg, borderRadius: 12, padding: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 12, color: C.sub, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 12 }}>📍 Origin</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="City"><input style={inp} value={f.originCity} onChange={e => set("originCity", e.target.value)} placeholder="Panama City" /></Field>
            <Field label="Country">
              <select style={{...inp, appearance:"none"}} value={f.originCountry} onChange={e => set("originCountry", e.target.value)}>
                <option value="">Select country...</option>
                {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
          </div>
        </div>

        <div style={{ background: C.bg, borderRadius: 12, padding: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 12, color: C.sub, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 12 }}>🛬 Destination</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="City"><input style={inp} value={f.destinationCity} onChange={e => set("destinationCity", e.target.value)} placeholder="Miami" /></Field>
            <Field label="Country">
              <select style={{...inp, appearance:"none"}} value={f.destinationCountry} onChange={e => set("destinationCountry", e.target.value)}>
                <option value="">Select country...</option>
                {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Departure Date"><input style={inp} type="date" value={f.departureDate} onChange={e => set("departureDate", e.target.value)} /></Field>
          <Field label="Return Date (optional)"><input style={inp} type="date" value={f.returnDate} onChange={e => set("returnDate", e.target.value)} /></Field>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Airline (optional)">
            <input style={inp} value={f.airline} onChange={e => set("airline", e.target.value)} placeholder="e.g. Copa Airlines" />
          </Field>
          <Field label="Flight Number (optional)">
            <input style={inp} value={f.flightNumber || ""} onChange={e => set("flightNumber", e.target.value)} placeholder="CM205" autoCapitalize="characters" />
          </Field>
        </div>

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
          <textarea style={{ ...inp, minHeight: 60 }} value={f.notes} onChange={e => set("notes", e.target.value)} placeholder="Any special notes about this trip..." />
        </Field>

        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <Btn v="secondary" onClick={onClose} full>Cancel</Btn>
          <Btn onClick={save} disabled={saving || !f.originCity || !f.destinationCity || !f.departureDate} full>
            {saving ? "Saving..." : (trip ? "Save Changes" : "Create Trip")}
          </Btn>
        </div>
      </div>
    </Modal>
  );
};

// ── CHECKLIST ITEM ───────────────────────────────────────
const ChecklistItem = ({ item, tripPets, onTogglePet, onToggleAll, onUpload, onDelete }) => {
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
                      ? <img src={pet.photo_url} style={{ width: 20, height: 20, borderRadius: "50%", objectFit: "cover" }} />
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
        <button onClick={() => onDelete(item.id)}
          style={{ background: C.dangerDim, border: `1px solid ${C.danger}44`, borderRadius: 8, padding: "5px 8px", color: C.danger, cursor: "pointer", flexShrink: 0 }}>🗑</button>
      </div>
    </div>
  );
};


const TripDetail = ({ trip, userId, dogs, onBack, onUpdate }) => {
  const [checklist, setChecklist] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState(null);
  const [buyingCredits, setBuyingCredits] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [showUploadEntry, setShowUploadEntry] = useState(false);
  const [newItem, setNewItem] = useState({ title: "", description: "", category: "other", deadline_date: "", notes: "" });
  const [entryDoc, setEntryDoc] = useState({ name: "", notes: "", file: null });
  const fr = useRef();

  const tripPets = dogs.filter(d => (trip.pet_ids || []).includes(d.id));
  const st = tripStatus(trip);
  const completed = checklist.filter(i => i.is_completed).length;

  useEffect(() => { loadData(); }, [trip.id]);

  const loadData = async () => {
    setLoading(true);
    const [{ data: cl }, { data: docs }] = await Promise.all([
      supabase.from('trip_checklist_items').select('*').eq('trip_id', trip.id).order('sort_order'),
      supabase.from('trip_documents').select('*').eq('trip_id', trip.id).order('created_at', { ascending: false }),
    ]);
    setChecklist(cl || []);
    setDocuments(docs || []);
    setLoading(false);
  };

  const generateRequirements = async () => {
    setGenerating(true); setGenError(null);
    try {
      const items = await generateChecklist(trip, tripPets, userId);
      const now = new Date().toISOString();
      const depDate = new Date(trip.departure_date + 'T12:00:00');
      const daysToDate = (days) => {
        if (!days && days !== 0) return null;
        const d = new Date(depDate.getTime() - days * 86400000);
        return d.toISOString().slice(0, 10);
      };

      const toInsert = items.map((item, i) => ({
        trip_id: trip.id, user_id: userId,
        title: item.title || 'Requirement',
        description: item.description || null,
        category: item.category || 'other',
        deadline_date: item.deadline_days_before ? daysToDate(item.deadline_days_before) : null,
        deadline_window_start: item.window_start_days ? daysToDate(item.window_start_days) : null,
        deadline_window_end: item.window_end_days ? daysToDate(item.window_end_days) : null,
        requires_document: item.requires_document === true,
        source_url: item.source_url || null,
        researched_at: now,
        notes: item.notes || null,
        sort_order: i,
      }));
      const { data } = await supabase.from('trip_checklist_items').insert(toInsert).select();
      if (data) setChecklist(prev => [...prev, ...data]);
    } catch (e) {
      setGenError(e);
    }
    setGenerating(false);
  };

  const togglePet = async (item, petId, done) => {
    const current = item.pet_completions || {};
    const updated = { ...current, [petId]: done };
    const allDone = tripPets.every(p => updated[p.id] === true);
    const { data } = await supabase.from('trip_checklist_items')
      .update({
        pet_completions: updated,
        is_completed: allDone,
        completed_date: allDone ? today() : null
      })
      .eq('id', item.id).select().single();
    if (data) setChecklist(prev => prev.map(x => x.id === item.id ? data : x));
  };

  const toggleAll = async (item, done) => {
    const updated = {};
    tripPets.forEach(p => updated[p.id] = done);
    const { data } = await supabase.from('trip_checklist_items')
      .update({
        pet_completions: updated,
        is_completed: done,
        completed_date: done ? today() : null
      })
      .eq('id', item.id).select().single();
    if (data) setChecklist(prev => prev.map(x => x.id === item.id ? data : x));
  };

  // Legacy single toggle (no pets on trip)
  const toggleItem = async (item) => {
    if (tripPets.length > 0) {
      toggleAll(item, !item.is_completed);
      return;
    }
    const { data } = await supabase.from('trip_checklist_items')
      .update({ is_completed: !item.is_completed, completed_date: !item.is_completed ? today() : null })
      .eq('id', item.id).select().single();
    if (data) setChecklist(prev => prev.map(x => x.id === item.id ? data : x));
  };

  const uploadDoc = async (item, file) => {
    if (!file) return;
    const path = `${userId}/trips/${trip.id}/${item.id}_${file.name}`;
    await supabase.storage.from('documents').upload(path, file, { upsert: true });
    const { data } = await supabase.from('trip_documents').insert({
      trip_id: trip.id, user_id: userId, checklist_item_id: item.id,
      name: `${item.title} — ${file.name}`, doc_date: today(),
      file_path: path, is_entry_document: false,
    }).select().single();
    if (data) { setDocuments(prev => [...prev, data]); await toggleItem(item); }
  };

  const deleteItem = async (id) => {
    await supabase.from('trip_checklist_items').delete().eq('id', id);
    setChecklist(prev => prev.filter(x => x.id !== id));
  };

  const addManualItem = async () => {
    if (!newItem.title) return;
    const { data } = await supabase.from('trip_checklist_items').insert({
      trip_id: trip.id, user_id: userId, ...newItem, sort_order: checklist.length,
    }).select().single();
    if (data) { setChecklist(prev => [...prev, data]); setShowAddItem(false); setNewItem({ title: "", description: "", category: "other", deadline_date: "", notes: "" }); }
  };

  const uploadEntryDoc = async () => {
    if (!entryDoc.name) return;
    let path = null;
    if (entryDoc.file) {
      path = `${userId}/trips/${trip.id}/entry_${entryDoc.file.name}`;
      await supabase.storage.from('documents').upload(path, entryDoc.file, { upsert: true });
    }
    const { data } = await supabase.from('trip_documents').insert({
      trip_id: trip.id, user_id: userId, name: entryDoc.name,
      notes: entryDoc.notes, doc_date: today(), file_path: path, is_entry_document: true,
    }).select().single();
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
        <div style={{ maxWidth: 680, margin: "0 auto", display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={onBack} style={{ background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 10, padding: "8px 12px", color: "#fff", cursor: "pointer", fontSize: 16 }}>←</button>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Lora', serif", fontSize: 20, color: "#fff", fontWeight: 600 }}>{trip.origin_city} → {trip.destination_city}</div>
            <div style={{ color: "#F5C45E", fontSize: 13, marginTop: 2 }}>{fmt(trip.departure_date)}{trip.return_date ? ` · Return ${fmt(trip.return_date)}` : ""}</div>
          </div>
          <Badge label={st.label} color={st.color} />
        </div>
      </div>

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "20px 16px" }}>
        {checklist.length > 0 && (
          <Card style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontWeight: 700 }}>Checklist Progress</span>
              <span style={{ fontWeight: 800, color: completed === checklist.length ? "#4CAF50" : C.accent }}>{completed}/{checklist.length} complete</span>
            </div>
            <div style={{ background: C.border, borderRadius: 20, height: 8, overflow: "hidden" }}>
              <div style={{ background: completed === checklist.length ? "#4CAF50" : C.accent, height: "100%", borderRadius: 20, width: `${checklist.length > 0 ? (completed / checklist.length) * 100 : 0}%`, transition: "width .3s" }} />
            </div>
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

          {checklist.map(item => (
            <ChecklistItem key={item.id} item={item} tripPets={tripPets} onTogglePet={togglePet} onToggleAll={toggleAll} onUpload={uploadDoc} onDelete={deleteItem} />
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

      {showAddItem && (
        <Modal title="Add Requirement" onClose={() => setShowAddItem(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Field label="Title"><input style={inp} value={newItem.title} onChange={e => setNewItem(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Health Certificate" /></Field>
            <Field label="Category">
              <select style={inp} value={newItem.category} onChange={e => setNewItem(p => ({ ...p, category: e.target.value }))}>
                {categories.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
              </select>
            </Field>
            <Field label="Description"><textarea style={{ ...inp, minHeight: 60 }} value={newItem.description} onChange={e => setNewItem(p => ({ ...p, description: e.target.value }))} /></Field>
            <Field label="Deadline Date"><input style={inp} type="date" value={newItem.deadline_date} onChange={e => setNewItem(p => ({ ...p, deadline_date: e.target.value }))} /></Field>
            <Field label="Notes / Warnings"><input style={inp} value={newItem.notes} onChange={e => setNewItem(p => ({ ...p, notes: e.target.value }))} /></Field>
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
            <Field label="Document Name"><input style={inp} value={entryDoc.name} onChange={e => setEntryDoc(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Panama Import Receipt" /></Field>
            <Field label="Notes"><input style={inp} value={entryDoc.notes} onChange={e => setEntryDoc(p => ({ ...p, notes: e.target.value }))} /></Field>
            <input ref={fr} type="file" accept="image/*,.pdf" style={{ display: "none" }} onChange={e => setEntryDoc(p => ({ ...p, file: e.target.files[0] }))} />
            <div style={{ border: `2px dashed ${C.border}`, borderRadius: 12, padding: 20, textAlign: "center", cursor: "pointer" }} onClick={() => fr.current.click()}>
              {entryDoc.file ? <div style={{ color: C.accent }}>✓ {entryDoc.file.name}</div> : <div style={{ color: C.muted }}>📷 Tap to upload photo or PDF</div>}
            </div>
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
    const { data } = await supabase.from("dogs").select("*").eq("user_id", userId).order("name");
    setDogs(data || []);
  };

  const loadTrips = async () => {
    setLoading(true);
    const { data } = await supabase.from('trips').select('*').eq('user_id', userId).order('departure_date');
    setTrips(data || []);
    setLoading(false);
  };

  if (selectedTrip) {
    const trip = trips.find(t => t.id === selectedTrip);
    if (trip) return (
      <TripDetail trip={trip} userId={userId} dogs={dogs}
        onBack={() => setSelectedTrip(null)}
        onUpdate={updated => { setTrips(prev => prev.map(t => t.id === updated.id ? updated : t)); }}
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
                {trip.airline && <div><span style={{ color: C.muted, fontWeight: 600 }}>Airline </span>{trip.airline}</div>}
                {trip.flight_number && <div><span style={{ color: C.muted, fontWeight: 600 }}>Flight </span>{trip.flight_number}</div>}
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
