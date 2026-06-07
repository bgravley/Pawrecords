// src/Emergency.jsx — Public pet health record page
// Accessible via yourpetpass.com/emergency/[token] — no login required
import { useState, useEffect } from "react";
import { supabase } from "./lib/supabase";

const fmt = d => {
  if (!d) return "—";
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const vSt = due => {
  if (!due) return { c: "#8B7355", label: "Not recorded" };
  const d = Math.round((new Date(due + "T12:00:00") - new Date()) / 86400000);
  if (d < 0) return { c: "#C4714A", label: `Overdue ${Math.abs(d)}d` };
  if (d <= 30) return { c: "#E8A838", label: `Due in ${d}d` };
  return { c: "#2D7D6F", label: "Current ✓" };
};

export default function Emergency({ token }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!token) { setNotFound(true); setLoading(false); return; }
    loadPet();
  }, [token]);

  const loadPet = async () => {
    // Find dog by emergency_token
    const { data: dogs, error } = await supabase
      .from("dogs")
      .select("*")
      .eq("emergency_token", token)
      .limit(1);

    if (error || !dogs?.length) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    const dog = dogs[0];

    // Load all health data for this dog
    const [{ data: vaccines }, { data: medications }, { data: allergies }, { data: visits }] = await Promise.all([
      supabase.from("vaccinations").select("*").eq("dog_id", dog.id).order("date_given", { ascending: false }),
      supabase.from("medications").select("*").eq("dog_id", dog.id).eq("active", true),
      supabase.from("allergies").select("*").eq("dog_id", dog.id),
      supabase.from("visits").select("*").eq("dog_id", dog.id).order("visit_date", { ascending: false }).limit(5),
    ]);

    setData({ dog, vaccines: vaccines || [], medications: medications || [], allergies: allergies || [], visits: visits || [] });
    setLoading(false);
  };

  const teal = "#1E5C52";
  const gold = "#E8A838";
  const danger = "#C4714A";

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#FAF6F0", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Nunito', sans-serif" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🐾</div>
        <div style={{ fontSize: 18, color: teal, fontWeight: 700 }}>Loading health record...</div>
      </div>
    </div>
  );

  if (notFound) return (
    <div style={{ minHeight: "100vh", background: "#FAF6F0", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Nunito', sans-serif", padding: 20 }}>
      <div style={{ textAlign: "center", maxWidth: 400 }}>
        <div style={{ fontSize: 50, marginBottom: 16 }}>🔍</div>
        <div style={{ fontFamily: "'Lora', serif", fontSize: 26, color: teal, marginBottom: 8 }}>Record Not Found</div>
        <div style={{ color: "#5A4535", fontSize: 15, lineHeight: 1.7 }}>This QR code may have been regenerated or is invalid. Please contact the pet's owner.</div>
        <div style={{ marginTop: 20 }}>
          <a href="https://yourpetpass.com" style={{ color: teal, fontWeight: 700, fontSize: 14 }}>YourPetPass.com</a>
        </div>
      </div>
    </div>
  );

  const { dog, vaccines, medications, allergies, visits } = data;
  const ptLabel = dog.pet_type === "service_animal" ? "Service Animal" : dog.pet_type === "esa" ? "Emotional Support Animal" : null;
  const ptColor = dog.pet_type === "service_animal" ? teal : dog.pet_type === "esa" ? gold : null;
  const age = dog.dob ? Math.floor((Date.now() - new Date(dog.dob + "T12:00:00")) / (365.25 * 86400000)) : null;
  const overdueVaccines = vaccines.filter(v => v.next_due && new Date(v.next_due) < new Date());
  const generated = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

  const card = (children, style = {}) => (
    <div style={{ background: "#FFFFFF", border: "1px solid #E8DDD0", borderRadius: 16, padding: 20, marginBottom: 16, boxShadow: "0 2px 8px rgba(44,32,23,0.06)", ...style }}>
      {children}
    </div>
  );

  const sectionTitle = (emoji, title, color = teal) => (
    <div style={{ fontWeight: 800, fontSize: 13, color, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
      <span>{emoji}</span> {title}
    </div>
  );

  const row = (label, value) => value ? (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #F0E8DC", fontSize: 14 }}>
      <span style={{ color: "#8B7355", fontWeight: 600 }}>{label}</span>
      <span style={{ color: "#2C2017", fontWeight: 500, textAlign: "right", maxWidth: "60%" }}>{value}</span>
    </div>
  ) : null;

  return (
    <div style={{ minHeight: "100vh", background: "#FAF6F0", fontFamily: "'Nunito', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&family=Lora:ital,wght@0,600;1,400&display=swap');`}</style>

      {/* Header */}
      <div style={{ background: teal, padding: "20px 20px 24px" }}>
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, flexShrink: 0 }}>
              🐾
            </div>
            <div>
              <div style={{ fontFamily: "'Lora', serif", fontSize: 28, color: "#FFFFFF", fontWeight: 600 }}>{dog.name}</div>
              <div style={{ color: "#F5C45E", fontSize: 14 }}>{dog.breed || "Dog"}{age !== null ? ` · ${age} years old` : ""}</div>
            </div>
          </div>
          {ptLabel && ptColor && (
            <div style={{ background: "rgba(255,255,255,0.15)", borderRadius: 10, padding: "8px 14px", display: "inline-flex", alignItems: "center", gap: 8, marginTop: 4 }}>
              <span>{dog.pet_type === "service_animal" ? "🦺" : "💙"}</span>
              <span style={{ color: "#FFFFFF", fontWeight: 700, fontSize: 14 }}>{ptLabel}</span>
            </div>
          )}
        </div>
      </div>

      {/* Emergency banner if overdue vaccines */}
      {overdueVaccines.length > 0 && (
        <div style={{ background: "#C4714A14", borderBottom: "2px solid #C4714A" }}>
          <div style={{ maxWidth: 600, margin: "0 auto", padding: "12px 20px", display: "flex", alignItems: "center", gap: 10, color: danger }}>
            <span style={{ fontSize: 20 }}>⚠️</span>
            <span style={{ fontWeight: 700, fontSize: 14 }}>{overdueVaccines.length} overdue vaccination{overdueVaccines.length > 1 ? "s" : ""} — {overdueVaccines.map(v => v.name).join(", ")}</span>
          </div>
        </div>
      )}

      <div style={{ maxWidth: 600, margin: "0 auto", padding: "20px 16px 40px" }}>

        {/* Emergency Alert — Allergies */}
        {allergies.length > 0 && card(
          <>
            {sectionTitle("🚨", "Known Allergies", danger)}
            {allergies.map(a => (
              <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #F0E8DC" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{a.allergen}</div>
                  <div style={{ fontSize: 13, color: "#5A4535" }}>{a.reaction}</div>
                </div>
                <span style={{ background: a.severity === "severe" ? "#C4714A20" : a.severity === "moderate" ? "#E8A83820" : "#2D7D6F20", color: a.severity === "severe" ? danger : a.severity === "moderate" ? gold : teal, borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 700 }}>
                  {a.severity.toUpperCase()}
                </span>
              </div>
            ))}
          </>,
          { border: "2px solid #C4714A44" }
        )}

        {/* Emergency Contact */}
        {(dog.emergency_contact || dog.emergency_phone) && card(
          <>
            {sectionTitle("📞", "Emergency Contact")}
            <div style={{ fontSize: 16, fontWeight: 700, color: "#2C2017", marginBottom: 4 }}>{dog.emergency_contact}</div>
            {dog.emergency_phone && (
              <a href={`tel:${dog.emergency_phone_code || ""}${dog.emergency_phone}`}
                style={{ display: "inline-flex", alignItems: "center", gap: 8, background: teal, color: "#fff", borderRadius: 10, padding: "10px 18px", fontWeight: 700, fontSize: 15, textDecoration: "none", marginTop: 8 }}>
                📞 Call {dog.emergency_phone_code || "+1"} {dog.emergency_phone}
              </a>
            )}
            {dog.emergency_whatsapp && (
              <a href={`https://wa.me/${(dog.emergency_whatsapp_code || "+1").replace("+", "")}${dog.emergency_whatsapp.replace(/\D/g, "")}`}
                style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#25D366", color: "#fff", borderRadius: 10, padding: "10px 18px", fontWeight: 700, fontSize: 15, textDecoration: "none", marginTop: 8, marginLeft: 8 }}>
                💬 WhatsApp
              </a>
            )}
          </>,
          { border: "2px solid #2D7D6F44" }
        )}

        {/* Pet Profile */}
        {card(<>
          {sectionTitle("🐾", "Pet Profile")}
          {row("Name", dog.name)}
          {row("Breed", dog.breed)}
          {row("Date of Birth", fmt(dog.dob))}
          {row("Age", age !== null ? `${age} years` : null)}
          {row("Weight", dog.weight ? `${dog.weight} lbs` : null)}
          {row("Color", dog.color)}
          {row("Sex", dog.gender ? (dog.gender.charAt(0).toUpperCase() + dog.gender.slice(1)) + (dog.neutered ? " · Neutered/Spayed" : "") : null)}
          {row("Microchip", dog.microchip)}
          {ptLabel && row("Classification", ptLabel)}
        </>)}

        {/* Active Medications */}
        {medications.length > 0 && card(<>
          {sectionTitle("💊", "Active Medications")}
          {medications.map(m => (
            <div key={m.id} style={{ padding: "8px 0", borderBottom: "1px solid #F0E8DC" }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{m.name}</div>
              <div style={{ fontSize: 13, color: "#5A4535", marginTop: 2 }}>
                {m.dosage && <span>{m.dosage}</span>}
                {m.frequency && <span> · {m.frequency}</span>}
                {m.reason && <span> · {m.reason}</span>}
              </div>
            </div>
          ))}
        </>)}

        {/* Vaccinations */}
        {vaccines.length > 0 && card(<>
          {sectionTitle("💉", "Vaccinations")}
          {vaccines.map(v => {
            const st = vSt(v.next_due);
            return (
              <div key={v.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #F0E8DC" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{v.name}</div>
                  <div style={{ fontSize: 12, color: "#8B7355" }}>Given {fmt(v.date_given)}{v.vet_name ? ` · ${v.vet_name}` : ""}</div>
                </div>
                <span style={{ background: st.c + "20", color: st.c, borderRadius: 20, padding: "3px 10px", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>
                  {st.label}
                </span>
              </div>
            );
          })}
        </>)}

        {/* Recent Visits */}
        {visits.length > 0 && card(<>
          {sectionTitle("🏥", "Recent Vet Visits")}
          {visits.slice(0, 3).map(v => (
            <div key={v.id} style={{ padding: "8px 0", borderBottom: "1px solid #F0E8DC" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{v.reason}</span>
                <span style={{ fontSize: 12, color: "#8B7355" }}>{fmt(v.visit_date)}</span>
              </div>
              {v.diagnosis && <div style={{ fontSize: 13, color: "#5A4535" }}>Dx: {v.diagnosis}</div>}
              {v.vet_name && <div style={{ fontSize: 12, color: "#8B7355" }}>{v.vet_name}{v.clinic ? ` · ${v.clinic}` : ""}</div>}
            </div>
          ))}
        </>)}

        {/* Footer */}
        <div style={{ textAlign: "center", padding: "20px 0", borderTop: "1px solid #E8DDD0", marginTop: 8 }}>
          <div style={{ fontSize: 12, color: "#8B7355", marginBottom: 4 }}>
            Generated {generated}
          </div>
          <a href="https://yourpetpass.com" style={{ fontSize: 13, color: teal, fontWeight: 700, textDecoration: "none" }}>
            🐾 Powered by YourPetPass
          </a>
          <div style={{ fontSize: 11, color: "#8B7355", marginTop: 6 }}>
            Always consult a licensed veterinarian for medical advice.
          </div>
        </div>
      </div>
    </div>
  );
}
