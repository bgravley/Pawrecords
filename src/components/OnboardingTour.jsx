// src/components/OnboardingTour.jsx
// A lightweight, dependency-free product tour ("coach marks" / guided walkthrough).
// Shows a friendly step-by-step intro for new users. Appears automatically the
// first time someone reaches the dashboard, and can be re-launched anytime via
// the "Take a tour" button in the More tab. Remembers completion per-user in
// localStorage so it never nags a returning user.
//
// Design: dimmed full-screen overlay + a centered card per step. We deliberately
// use centered cards rather than pixel-anchoring to specific buttons — anchoring
// breaks the moment the UI shifts, and a new user on a phone benefits more from
// a clear, readable explanation than a tiny highlighted target. Each step names
// exactly where to tap ("the Overview tab at the bottom", "the + Add Pet button")
// so it stays useful without being fragile.

import { useState } from "react";

const BRAND = {
  teal: "#2D7D6F", tealDk: "#1E5C52", cream: "#FAF6F0",
  text: "#2C2017", brown: "#5A4535", amber: "#E8A838", border: "#E8DDD0",
};

const STEPS = [
  {
    emoji: "🐾",
    title: "Welcome to YourPetPass!",
    body: "Let's take 30 seconds to show you around. You can skip anytime, and re-launch this tour later from the More tab.",
  },
  {
    emoji: "➕",
    title: "1. Add your first pet",
    body: "Tap the “+ Add Pet” button on your Overview screen. You can add a dog or a cat — with their breed, birthday, weight, and microchip number. Everything else builds from here.",
  },
  {
    emoji: "💉",
    title: "2. Track vaccines & health",
    body: "Use the Vaccines and Health tabs at the bottom to log shots, allergies, and medications. We’ll flag anything overdue or due soon so you never lose track.",
  },
  {
    emoji: "📷",
    title: "3. Scan a document",
    body: "In a pet’s More tab, tap Documents to snap a photo of a vet record. Our AI reads it and fills in the details for you — no typing. (Premium feature.)",
  },
  {
    emoji: "✈️",
    title: "4. Plan pet travel",
    body: "Tap Travel in the bottom bar to plan a trip. We’ll generate a checklist of exactly what your pet needs for that route — vaccines, health certificates, and deadlines.",
  },
  {
    emoji: "📤",
    title: "5. Share a record instantly",
    body: "From any pet, use Export or Email to send a clean PDF of their full health record — perfect for a new vet, a boarding facility, or a pet sitter.",
  },
  {
    emoji: "🎉",
    title: "You’re all set!",
    body: "That’s the whole app. Start by adding your first pet — and remember, you can replay this tour anytime from the More tab. Welcome aboard!",
  },
];

export const TOUR_STORAGE_KEY = "ypp_tour_completed_v1";

export default function OnboardingTour({ onClose }) {
  const [step, setStep] = useState(0);
  const isFirst = step === 0;
  const isLast = step === STEPS.length - 1;
  const s = STEPS[step];

  const finish = () => {
    try { localStorage.setItem(TOUR_STORAGE_KEY, "true"); } catch (e) { /* ignore */ }
    onClose();
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9000,
        background: "rgba(30, 92, 82, 0.82)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20, backdropFilter: "blur(2px)",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) finish(); }}
    >
      <div
        style={{
          background: BRAND.cream, borderRadius: 20, maxWidth: 400, width: "100%",
          padding: "28px 24px 22px", boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
          fontFamily: "'Nunito', sans-serif", textAlign: "center",
        }}
      >
        {/* Skip button */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
          <button
            onClick={finish}
            style={{
              background: "none", border: "none", color: BRAND.brown,
              fontSize: 13, cursor: "pointer", padding: 4, textDecoration: "underline",
            }}
          >
            Skip tour
          </button>
        </div>

        <div style={{ fontSize: 46, marginBottom: 10 }}>{s.emoji}</div>
        <div style={{
          fontFamily: "'Lora', serif", fontSize: 22, fontWeight: 600,
          color: BRAND.tealDk, marginBottom: 12,
        }}>
          {s.title}
        </div>
        <div style={{ fontSize: 15, lineHeight: 1.65, color: BRAND.brown, marginBottom: 22 }}>
          {s.body}
        </div>

        {/* Progress dots */}
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 20 }}>
          {STEPS.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === step ? 22 : 7, height: 7, borderRadius: 4,
                background: i === step ? BRAND.teal : BRAND.border,
                transition: "all .2s",
              }}
            />
          ))}
        </div>

        {/* Navigation */}
        <div style={{ display: "flex", gap: 10 }}>
          {!isFirst && (
            <button
              onClick={() => setStep(step - 1)}
              style={{
                flex: 1, padding: "12px 0", borderRadius: 12, fontSize: 15, fontWeight: 700,
                background: "transparent", color: BRAND.teal, border: `1.5px solid ${BRAND.teal}`,
                cursor: "pointer", fontFamily: "'Nunito', sans-serif",
              }}
            >
              Back
            </button>
          )}
          <button
            onClick={() => (isLast ? finish() : setStep(step + 1))}
            style={{
              flex: 2, padding: "12px 0", borderRadius: 12, fontSize: 15, fontWeight: 700,
              background: BRAND.teal, color: "#fff", border: "none",
              cursor: "pointer", fontFamily: "'Nunito', sans-serif",
            }}
          >
            {isLast ? "Get Started 🎉" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
