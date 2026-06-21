// src/Marketing.jsx
import { useState, useEffect } from 'react';

const C = {
  bg: '#FAF6F0', card: '#FFFFFF', border: '#E8DDD0',
  teal: '#2D7D6F', tealDk: '#1E5C52', tealLt: '#4A9E90',
  brown: '#5A4535', muted: '#8B7355', text: '#2C2017',
  amber: '#E8A838', red: '#C4714A',
};

function FeatureCard({ icon, title, desc }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 22, textAlign: 'left' }}>
      <div style={{ fontSize: 30, marginBottom: 10 }}>{icon}</div>
      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6, color: C.text }}>{title}</div>
      <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.6 }}>{desc}</div>
    </div>
  );
}

function UseCaseCard({ image, eyebrow, title, body, featured }) {
  return (
    <div style={{
      background: featured ? C.tealDk : C.card,
      border: featured ? 'none' : `1px solid ${C.border}`,
      borderRadius: 18, overflow: 'hidden', textAlign: 'left',
      boxShadow: featured ? '0 8px 28px rgba(30,92,82,0.25)' : '0 2px 10px rgba(0,0,0,0.04)',
    }}>
      <div style={{ width: '100%', aspectRatio: '16/10', overflow: 'hidden' }}>
        <img src={image} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      </div>
      <div style={{ padding: 26 }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: featured ? '#A8D5CE' : C.teal, marginBottom: 6 }}>{eyebrow}</div>
        <div style={{ fontFamily: "'Lora', serif", fontSize: 20, fontWeight: 600, color: featured ? '#FFFFFF' : C.text, marginBottom: 10 }}>{title}</div>
        <div style={{ fontSize: 14.5, color: featured ? '#D4E8E4' : C.brown, lineHeight: 1.75 }}>{body}</div>
      </div>
    </div>
  );
}

function FAQItem({ q, a }) {
  return (
    <div style={{ borderBottom: `1px solid ${C.border}`, padding: '18px 0' }}>
      <div style={{ fontWeight: 700, fontSize: 15.5, color: C.text, marginBottom: 6 }}>{q}</div>
      <div style={{ fontSize: 14, color: C.brown, lineHeight: 1.65 }}>{a}</div>
    </div>
  );
}

function StepCard({ num, icon, title, desc }) {
  return (
    <div style={{ textAlign: 'center', flex: 1, minWidth: 160 }}>
      <div style={{ width: 52, height: 52, borderRadius: '50%', background: C.teal, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800, margin: '0 auto 14px', fontFamily: "'Lora', serif" }}>{num}</div>
      <div style={{ fontSize: 28, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontWeight: 700, fontSize: 15, color: C.text, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>{desc}</div>
    </div>
  );
}

export default function Marketing({ onLogin, onSignup }) {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showIOSHelp, setShowIOSHelp] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (installPrompt) {
      installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      if (outcome === 'accepted') setInstallPrompt(null);
    } else {
      setShowIOSHelp(true);
    }
  };

  const navBtn = { background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Nunito', sans-serif", fontSize: 14, fontWeight: 700 };

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: "'Nunito', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Lora:ital,wght@0,400;0,600;1,400;1,600&display=swap');`}</style>

      {/* NAV */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: C.tealDk, padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ fontFamily: "'Lora', serif", fontSize: 22, color: '#FFFFFF', fontWeight: 700 }}>
          🐾 Your<span style={{ color: '#F5C45E' }}>Pet</span>Pass
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <a href="#features" style={{ ...navBtn, color: '#D4E8E4', textDecoration: 'none' }}>Features</a>
          <a href="#use-cases" style={{ ...navBtn, color: '#D4E8E4', textDecoration: 'none' }}>Use Cases</a>
          <a href="#store" style={{ ...navBtn, color: '#D4E8E4', textDecoration: 'none' }}>Store</a>
          <button onClick={onLogin} style={{ ...navBtn, color: '#FFFFFF' }}>Login</button>
          <button onClick={onSignup} style={{ background: C.amber, color: '#1E1408', border: 'none', borderRadius: 10, padding: '9px 18px', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: "'Nunito', sans-serif" }}>Sign Up Free</button>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
          <img src="/Images/hero-cuddle.jpg" alt="Dog and cat resting together at home" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(30,92,82,0.85) 0%, rgba(30,92,82,0.93) 55%, rgba(30,92,82,0.97) 100%)' }} />
        </div>
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', padding: '72px 20px 56px', maxWidth: 760, margin: '0 auto' }}>
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#F5C45E', marginBottom: 14 }}>For Dogs & Cats — Health Records & Travel, Simplified</div>
          <h1 style={{ fontFamily: "'Lora', serif", fontSize: 'clamp(30px, 6vw, 46px)', fontWeight: 600, color: '#FFFFFF', lineHeight: 1.2, marginBottom: 18 }}>
            One place for every vet visit, vaccine, and trip your pet takes.
          </h1>
          <p style={{ fontSize: 17, color: '#D4E8E4', lineHeight: 1.7, marginBottom: 28 }}>
            Switch vets, travel across borders, or board your pet for the weekend — YourPetPass keeps every health record organized and ready, no matter where life takes you both.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={onSignup} style={{ background: C.amber, color: '#1E1408', border: 'none', borderRadius: 12, padding: '14px 28px', fontWeight: 800, fontSize: 16, cursor: 'pointer', fontFamily: "'Nunito', sans-serif" }}>
              Get Started Free
            </button>
            <button onClick={handleInstallClick} style={{ background: 'rgba(255,255,255,0.12)', color: '#FFFFFF', border: '1.5px solid rgba(255,255,255,0.4)', borderRadius: 12, padding: '14px 24px', fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: "'Nunito', sans-serif", display: 'flex', alignItems: 'center', gap: 8 }}>
              📲 Add to Your Phone
            </button>
          </div>
        </div>
      </section>

      {/* iOS / fallback install instructions modal */}
      {showIOSHelp && (
        <div onClick={() => setShowIOSHelp(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#FFFFFF', borderRadius: 18, padding: 28, maxWidth: 360, textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>📲</div>
            <div style={{ fontFamily: "'Lora', serif", fontSize: 19, fontWeight: 600, color: C.tealDk, marginBottom: 12 }}>Add YourPetPass to Your Phone</div>
            <div style={{ fontSize: 14, color: C.brown, lineHeight: 1.7, textAlign: 'left', marginBottom: 18 }}>
              <strong>On iPhone (Safari):</strong> Tap the Share icon, then "Add to Home Screen."<br/><br/>
              <strong>On Android (Chrome):</strong> Tap the ⋮ menu, then "Add to Home Screen" or "Install App."
            </div>
            <button onClick={() => setShowIOSHelp(false)} style={{ background: C.teal, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontWeight: 700, cursor: 'pointer', fontFamily: "'Nunito', sans-serif" }}>Got it</button>
          </div>
        </div>
      )}

      {/* HOW IT WORKS */}
      <section style={{ padding: '52px 20px 36px', maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ display: 'flex', gap: 40, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
          <div style={{ flex: '1 1 320px', minWidth: 280 }}>
            <h2 style={{ fontFamily: "'Lora', serif", fontSize: 26, color: C.tealDk, marginBottom: 18 }}>From vet visit to your pocket in seconds</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <StepCard num="1" icon="📷" title="Snap a photo" desc="Photograph any vet record, vaccine card, or health document." />
              <StepCard num="2" icon="🤖" title="AI organizes it" desc="Information is automatically extracted and saved to your pet's profile." />
              <StepCard num="3" icon="📱" title="Access it anywhere" desc="Pull it up at any vet, any country, any time — straight from your phone." />
            </div>
          </div>
          <div style={{ flex: '0 1 280px', textAlign: 'center' }}>
            <img src="/Images/howitworks-phone.jpg" alt="Pet health record shown on a phone" style={{ width: '100%', maxWidth: 280, borderRadius: 24, boxShadow: '0 16px 40px rgba(0,0,0,0.18)' }} />
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" style={{ padding: '40px 20px', maxWidth: 1000, margin: '0 auto' }}>
        <h2 style={{ fontFamily: "'Lora', serif", fontSize: 28, textAlign: 'center', color: C.tealDk, marginBottom: 8 }}>Everything in one place</h2>
        <p style={{ textAlign: 'center', color: C.muted, marginBottom: 32, fontSize: 15 }}>No more folders, no more texting your old vet for records.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          <FeatureCard icon="📋" title="Health Records" desc="Vaccines, vet visits, allergies, and medications — all tied to your pet, not one clinic." />
          <FeatureCard icon="📷" title="AI Document Scan" desc="Photo any vet record or vaccine card — AI extracts and saves it automatically." />
          <FeatureCard icon="✈️" title="AI Travel Checklists" desc="Route-specific requirements for flying or driving with your pet, generated in seconds." />
          <FeatureCard icon="⚖️" title="Weight Tracking" desc="Log weight at every visit and see trends over time." />
          <FeatureCard icon="🚨" title="QR Emergency Card" desc="A scannable health card for sitters, boarding, or if your pet is ever lost." />
          <FeatureCard icon="📤" title="Export & Share" desc="Export a complete health summary and email it to a vet, hotel, or daycare in seconds." />
        </div>
      </section>

      {/* USE CASES */}
      <section id="use-cases" style={{ padding: '48px 20px', maxWidth: 1080, margin: '0 auto' }}>
        <h2 style={{ fontFamily: "'Lora', serif", fontSize: 28, textAlign: 'center', color: C.tealDk, marginBottom: 8 }}>Built for real life with a pet</h2>
        <p style={{ textAlign: 'center', color: C.muted, marginBottom: 32, fontSize: 15 }}>Three ways pet owners actually use YourPetPass.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
          <UseCaseCard
            image="/Images/usecase-front-desk.jpg"
            eyebrow="Different Vets, One Record"
            title="You moved. Your vet didn't come with you."
            body="New city, new vet, and they're asking for vaccine history you don't have on hand. With YourPetPass, every record from every vet you've ever seen lives in one place — pull it up on your phone at the front desk, no calling your old clinic, no faxes."
          />
          <UseCaseCard
            image="/Images/usecase-airport.jpg"
            eyebrow="Traveling With Your Pet"
            title="Flying internationally? Know exactly what you need."
            body="Health certificates, country-specific import rules, airline pet policies — they all change, and missing one document can mean your pet doesn't fly. Generate an AI checklist for your exact route and get a clear, current list of what to handle and when."
          />
          <UseCaseCard
            featured
            image="/Images/usecase-daycare.jpg"
            eyebrow="The Real-World Story"
            title="Maria & Biscuit: a weekend trip, three states, two vets, one app."
            body="Maria drove from Austin to Denver for a long weekend, boarding Biscuit at a pet hotel for two nights mid-trip. The hotel needed proof of vaccines before check-in — she exported Biscuit's record and emailed it over from the parking lot. A week later, a limp sent them to an unfamiliar vet near Denver; the vet pulled up Biscuit's full history instantly, no guessing on prior treatments. Same trip, same app, two completely different problems solved."
          />
        </div>
      </section>

      {/* VET TRUST STRIP */}
      <section style={{ padding: '8px 20px 48px', maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, overflow: 'hidden', display: 'flex', flexWrap: 'wrap', alignItems: 'stretch' }}>
          <div style={{ flex: '1 1 280px', minHeight: 220 }}>
            <img src="/Images/feature-vet-checkup.jpg" alt="Veterinarian examining a dog" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </div>
          <div style={{ flex: '1 1 280px', padding: 28, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: C.teal, marginBottom: 8 }}>Walk Into Any Vet, Prepared</div>
            <div style={{ fontFamily: "'Lora', serif", fontSize: 21, color: C.text, marginBottom: 10 }}>"What vaccines have they had?" — you'll always know.</div>
            <div style={{ fontSize: 14.5, color: C.brown, lineHeight: 1.7 }}>
              Every vaccine, every visit, every medication — right there on your phone before the vet even asks. No more guessing, no more "I think it was sometime last year."
            </div>
          </div>
        </div>
      </section>

      {/* STORE — coming soon stub */}
      <section id="store" style={{ padding: '40px 20px', maxWidth: 680, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: 32 }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🛍️</div>
          <div style={{ fontFamily: "'Lora', serif", fontSize: 22, color: C.tealDk, marginBottom: 8 }}>YourPetPass Store — Coming Soon</div>
          <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.6 }}>
            Travel gear, ID tags, and pet essentials picked to pair with your YourPetPass profile.
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ padding: '40px 20px', maxWidth: 680, margin: '0 auto' }}>
        <h2 style={{ fontFamily: "'Lora', serif", fontSize: 24, textAlign: 'center', color: C.tealDk, marginBottom: 24 }}>Common Questions</h2>
        <FAQItem q="What is YourPetPass?" a="An app that keeps your pet's health records — vaccines, vet visits, allergies, medications — in one place, accessible no matter which vet you see, plus AI-generated travel checklists for flying or driving with your pet." />
        <FAQItem q="Does it work if I see different vets in different cities?" a="Yes — that's exactly the problem it's built to solve. Records stay attached to your pet's profile, not to any single clinic." />
        <FAQItem q="Can it help with airline or international travel requirements?" a="Yes. Generate a route-specific checklist covering health certificates, vaccination requirements, and airline pet policies." />
        <FAQItem q="Is YourPetPass free?" a="Yes, the free plan covers core health record storage. Premium adds AI scanning, AI travel checklists, weight tracking, document storage, and the QR emergency card, starting at $4.99/month." />
      </section>

      {/* FOOTER */}
      <footer style={{ textAlign: 'center', padding: '32px 20px', borderTop: `1px solid ${C.border}`, color: C.muted, fontSize: 13 }}>
        &copy; 2026 YourPetPass · RD Marketing LLC &nbsp;·&nbsp;
        <a href="/privacy.html" style={{ color: C.muted }}>Privacy</a> &nbsp;·&nbsp;
        <a href="/terms.html" style={{ color: C.muted }}>Terms</a> &nbsp;·&nbsp;
        <a href="/contact.html" style={{ color: C.muted }}>Contact</a>
      </footer>
    </div>
  );
}
