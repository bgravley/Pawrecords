const C = {
  forest: '#2C4A38',
  sage: '#7C9E87',
  lightSage: '#9DC4AA',
  mint: '#EAF4EE',
  warm: '#FAFCFB',
  gold: '#C9A84C',
  text: '#1A2E22',
  border: '#DCE8E0',
};

const messages = {
  'pet-travel': {
    eyebrow: 'PET TRAVEL',
    headline: "Travel with your pet's records already organized.",
    dek: 'Keep vaccination history, medical records and travel documents together, then build an AI-assisted travel checklist with official-source links for your route.',
  },
  'health-records': {
    eyebrow: 'PET HEALTH RECORDS',
    headline: "Your pet's health history belongs with you.",
    dek: 'Keep vaccine records, vet history, medications and important documents in one place so you are not rebuilding the story every time you change vets or travel.',
  },
  default: {
    eyebrow: 'HEALTH RECORDS & TRAVEL, SIMPLIFIED.',
    headline: "Your pet's health history belongs with you.",
    dek: 'One place for the records you need at the next vet visit, the next boarding stay and the next trip.',
  },
};

function sourceKey() {
  if (typeof window === 'undefined') return 'default';
  const params = new URLSearchParams(window.location.search);
  const from = (params.get('from') || '').toLowerCase();
  if (from.includes('travel')) return 'pet-travel';
  if (from.includes('record') || from.includes('vet')) return 'health-records';
  return 'default';
}

export default function SignupFunnel({ onSignup, onLogin }) {
  const copy = messages[sourceKey()] || messages.default;

  return (
    <div style={{ minHeight: '100vh', background: C.warm, color: C.text, fontFamily: "'Lora', serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=Lora:wght@400;600&display=swap');
        *{box-sizing:border-box}
        .signup-shell{display:grid;grid-template-columns:minmax(0,1.08fr) minmax(360px,.92fr);gap:56px;align-items:center;max-width:1180px;margin:0 auto;padding:64px 28px 80px}
        .signup-benefits{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:30px 0}
        .signup-card{background:white;border:1px solid #DCE8E0;border-radius:24px;padding:30px;box-shadow:0 18px 50px rgba(44,74,56,.12)}
        @media(max-width:820px){.signup-shell{grid-template-columns:1fr;gap:30px;padding:32px 20px 56px}.signup-benefits{grid-template-columns:1fr}.signup-copy{text-align:left}}
      `}</style>

      <header style={{ background: C.forest, padding: '16px 24px' }}>
        <a href="/" aria-label="YourPetPass home">
          <img src="/logo_horizontal_cream_transparent.png" alt="YourPetPass" style={{ height: 42, display: 'block' }} />
        </a>
      </header>

      <main className="signup-shell">
        <section className="signup-copy">
          <div style={{ color: C.gold, fontSize: 12, fontWeight: 700, letterSpacing: '.12em', marginBottom: 14 }}>{copy.eyebrow}</div>
          <h1 style={{ fontFamily: "'Playfair Display', serif", color: C.forest, fontSize: 'clamp(38px,6vw,64px)', lineHeight: 1.04, margin: '0 0 18px', maxWidth: 700 }}>{copy.headline}</h1>
          <p style={{ color: '#5C7464', fontSize: 19, lineHeight: 1.7, margin: 0, maxWidth: 680 }}>{copy.dek}</p>

          <div className="signup-benefits">
            {[
              ['Health records in one place', 'Keep vaccine history, vet visits and key medical information attached to your pet.'],
              ['Travel documents organized', 'Keep the records you may need for trips together instead of searching old emails and portals.'],
              ['AI-assisted travel planning', 'Build route-specific planning checklists with official-source links to help you research current requirements.'],
              ['Emergency-ready information', 'Choose supported emergency details that can be available through your pet’s secure QR page.'],
            ].map(([title, text]) => (
              <div key={title} style={{ background: C.mint, border: `1px solid ${C.border}`, borderRadius: 16, padding: '18px 18px 17px' }}>
                <div style={{ color: C.forest, fontWeight: 700, marginBottom: 5 }}>{title}</div>
                <div style={{ color: '#5C7464', fontSize: 13.5, lineHeight: 1.6 }}>{text}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', color: C.sage, fontSize: 13.5 }}>
            <span>Free to start</span><span>•</span><span>No credit card required</span><span>•</span><span>Your records stay with your pet</span>
          </div>
        </section>

        <aside className="signup-card" aria-label="Create your YourPetPass account">
          <div style={{ background: C.mint, borderRadius: 18, padding: 22, marginBottom: 22 }}>
            <div style={{ fontFamily: "'Playfair Display', serif", color: C.forest, fontWeight: 700, fontSize: 28, lineHeight: 1.2, marginBottom: 8 }}>Create your free account</div>
            <div style={{ color: '#5C7464', fontSize: 14, lineHeight: 1.65 }}>Start organizing your pet's health records now. Upgrade only if you want premium features later.</div>
          </div>

          <button aria-label="Create a free YourPetPass account" onClick={onSignup} style={{ width: '100%', border: 'none', borderRadius: 14, background: C.gold, color: C.text, fontFamily: "'Lora', serif", fontWeight: 700, fontSize: 16, padding: '15px 18px', cursor: 'pointer', boxShadow: '0 5px 16px rgba(201,168,76,.24)' }}>Create Free Account</button>
          <div style={{ textAlign: 'center', color: C.sage, fontSize: 12.5, margin: '13px 0 18px' }}>Google or email signup available</div>

          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 18 }}>
            <div style={{ color: C.forest, fontWeight: 700, fontSize: 13, marginBottom: 10 }}>What happens next</div>
            <ol style={{ margin: 0, paddingLeft: 20, color: '#5C7464', fontSize: 13.5, lineHeight: 1.75 }}>
              <li>Create your free account.</li>
              <li>Add your pet.</li>
              <li>Start adding records or planning your next trip.</li>
            </ol>
          </div>

          <div style={{ textAlign: 'center', marginTop: 22, color: C.sage, fontSize: 12.5 }}>
            Already have an account?{' '}
            <button aria-label="Sign in to YourPetPass" onClick={onLogin} style={{ background: 'none', border: 'none', padding: 0, color: C.forest, font: 'inherit', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 }}>Sign in</button>
          </div>
        </aside>
      </main>

      <section style={{ background: C.forest, padding: '42px 24px', textAlign: 'center' }}>
        <div style={{ fontFamily: "'Playfair Display', serif", color: 'white', fontSize: 30, fontWeight: 700, marginBottom: 10 }}>One app for every trip and every vet visit.</div>
        <div style={{ color: C.lightSage, maxWidth: 650, margin: '0 auto', lineHeight: 1.7 }}>YourPetPass helps you keep the information you already have organized and accessible when you need it.</div>
      </section>
    </div>
  );
}
