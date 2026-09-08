#!/usr/bin/env python3
from pathlib import Path

p = Path('src/Marketing.jsx')
text = p.read_text(encoding='utf-8')

replacements = [
    ("          <a href=\"#store\" style={{ ...navBtn, color: '#EAF4EE', textDecoration: 'none' }}>Store</a>\n", ""),
    ("            <h2 style={{ fontFamily: \"'Playfair Display', serif\", fontSize: 26, fontWeight: 700, color: C.tealDk, marginBottom: 18 }}>From vet visit to your pocket in seconds</h2>",
     "            <h2 style={{ fontFamily: \"'Playfair Display', serif\", fontSize: 26, fontWeight: 700, color: C.tealDk, marginBottom: 18 }}>From vet visit to your pocket, without the paper chase</h2>"),
    ("          <FeatureCard icon=\"🚨\" title=\"QR Emergency Card\" desc=\"A scannable health card for sitters, boarding, or if your pet is ever lost.\" />",
     "          <FeatureCard icon=\"🚨\" title=\"QR Emergency Card\" desc=\"If you enable it, share a tokenized emergency page with the supported details you choose — without exposing full medical records or private uploads.\" />"),
    ("          <FeatureCard icon=\"📤\" title=\"Export & Share\" desc=\"Export a complete health summary and email it to a vet, hotel, or daycare in seconds.\" />",
     "          <FeatureCard icon=\"📤\" title=\"Export & Share\" desc=\"Export a health summary and email it to a vet, hotel, or daycare when you need to share records.\" />"),
    ("        <FAQItem q=\"What is YourPetPass?\" a=\"An app that keeps your pet's health records — vaccines, vet visits, allergies, medications — in one place, accessible no matter which vet you see, plus AI-generated travel checklists for flying or driving with your pet.\" />",
     "        <FAQItem q=\"What is YourPetPass?\" a=\"An app that keeps your pet's health records — vaccines, vet visits, allergies, medications — in one place, accessible no matter which vet you see, plus AI-assisted travel planning checklists with official-source links.\" />"),
    ("        <FAQItem q=\"Can it help with airline or international travel requirements?\" a=\"Yes. Generate a route-specific checklist covering health certificates, vaccination requirements, and airline pet policies.\" />",
     "        <FAQItem q=\"Can it help with airline or international travel requirements?\" a=\"Yes. YourPetPass can create a route-specific AI-assisted planning checklist with official-source links. Confirm country requirements with the responsible government authority and carrier-specific policies with the carrier before travel.\" />"),
    ("        <FAQItem q=\"Is YourPetPass free?\" a=\"Yes, the free plan covers core health record storage. Premium adds AI scanning, AI travel checklists, weight tracking, document storage, and the QR emergency card, starting at $4.99/month.\" />",
     "        <FAQItem q=\"Is YourPetPass free?\" a=\"Yes, the free plan covers core health record storage. Premium adds AI document scanning, AI-assisted travel planning, weight tracking, document storage, and the owner-controlled QR emergency card, starting at $4.99/month.\" />"),
]

for old, new in replacements:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'expected exactly one marketing anchor, found {count}: {old[:100]!r}')
    text = text.replace(old, new, 1)

store_block = '''      {/* STORE — coming soon stub */}
      <section id="store" style={{ padding: '40px 20px', maxWidth: 680, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: 32 }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🛍️</div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: C.tealDk, marginBottom: 8 }}>YourPetPass Store — Coming Soon</div>
          <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.6 }}>
            Travel gear, ID tags, and pet essentials picked to pair with your YourPetPass profile.
          </div>
        </div>
      </section>

'''
if text.count(store_block) != 1:
    raise SystemExit(f'expected exactly one unfinished Store block, found {text.count(store_block)}')
text = text.replace(store_block, '', 1)

p.write_text(text, encoding='utf-8')
print('public homepage launch hygiene patch applied')
