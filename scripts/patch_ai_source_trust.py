#!/usr/bin/env python3
from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly 1 match, found {count}')
    return text.replace(old, new, 1)

# Marketing claims: describe what the product demonstrably does without
# implying that AI output is automatically correct or final.
marketing_path = Path('src/Marketing.jsx')
marketing = marketing_path.read_text(encoding='utf-8')
marketing = replace_once(
    marketing,
    '<StepCard num="2" icon="🤖" title="AI organizes it" desc="Information is automatically extracted and saved to your pet\'s profile." />',
    '<StepCard num="2" icon="🤖" title="AI helps organize it" desc="AI extracts details for you to review before you rely on them." />',
    'marketing document-scan step',
)
marketing = replace_once(
    marketing,
    '<FeatureCard icon="📷" title="AI Document Scan" desc="Photo any vet record or vaccine card — AI extracts and saves it automatically." />',
    '<FeatureCard icon="📷" title="AI Document Scan" desc="Photo a vet record or vaccine card — AI extracts details for you to review." />',
    'marketing AI scan feature claim',
)
marketing = replace_once(
    marketing,
    '<FeatureCard icon="✈️" title="AI Travel Checklists" desc="Route-specific requirements for flying or driving with your pet, generated in seconds." />',
    '<FeatureCard icon="✈️" title="AI Travel Checklists" desc="Build a route-specific planning checklist with official-source links, then verify current rules before travel." />',
    'marketing AI travel feature claim',
)
marketing = replace_once(
    marketing,
    '<a href="/terms.html" style={{ color: C.muted }}>Terms</a> &nbsp;·&nbsp;\n        <a href="/contact.html" style={{ color: C.muted }}>Contact</a>',
    '<a href="/terms.html" style={{ color: C.muted }}>Terms</a> &nbsp;·&nbsp;\n        <a href="/ai-policy.html" style={{ color: C.muted }}>AI & Sources</a> &nbsp;·&nbsp;\n        <a href="/contact.html" style={{ color: C.muted }}>Contact</a>',
    'marketing AI policy footer link',
)
marketing_path.write_text(marketing, encoding='utf-8')

# Travel UI/storage: research time and human-verification time must remain
# separate. New AI research starts pending review and is never stamped as
# human verified merely because it was generated.
travel_path = Path('src/Travel.jsx')
travel = travel_path.read_text(encoding='utf-8')
travel = replace_once(
    travel,
    "        source_authority: item.source_authority || null,\n        last_verified_at: now,\n        researched_at: now,",
    "        source_authority: item.source_authority || null,\n        last_verified_at: null,\n        researched_at: now,",
    'generated checklist verification timestamp',
)
old_meta = '''              {(item.source_authority || item.last_verified_at || item.researched_at) && <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{item.source_authority || "Official authority"}{(item.last_verified_at || item.researched_at) ? ` · Checked ${new Date(item.last_verified_at || item.researched_at).toLocaleDateString()}` : ""}{item.effective_date ? ` · Effective ${fmt(item.effective_date)}` : ""}{item.source_expires_at ? ` · Expires ${fmt(item.source_expires_at)}` : ""}</div>}'''
new_meta = '''              {(item.source_authority || item.last_verified_at || item.researched_at) && <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{item.source_authority || "Official authority"}{item.human_review_status === "verified" && item.last_verified_at ? ` · Human verified ${new Date(item.last_verified_at).toLocaleDateString()}` : item.researched_at ? ` · Researched ${new Date(item.researched_at).toLocaleDateString()}` : ""}{item.effective_date ? ` · Effective ${fmt(item.effective_date)}` : ""}{item.source_expires_at ? ` · Expires ${fmt(item.source_expires_at)}` : ""}</div>}'''
# The source card exists once in source even though connector search can return
# duplicated snippets. Enforce exact source match here.
travel = replace_once(travel, old_meta, new_meta, 'travel source status language')
heading = '''            <h3 style={{ fontFamily: "'Lora', serif", fontSize: 20, color: C.text }}>Requirements Checklist</h3>
            <div style={{ display: "flex", gap: 8 }}>'''
heading_new = '''            <div>
              <h3 style={{ fontFamily: "'Lora', serif", fontSize: 20, color: C.text }}>Requirements Checklist</h3>
              <div style={{fontSize:11,color:C.muted,marginTop:3,maxWidth:420,lineHeight:1.45}}>AI-assisted planning only. Country rules should link to the responsible government authority. Confirm official requirements before travel.</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>'''
travel = replace_once(travel, heading, heading_new, 'travel checklist disclosure')
travel_path.write_text(travel, encoding='utf-8')

# Server research and review prompts: make source scope explicit at both AI
# stages, not just in client prompt text.
api_path = Path('api/ai-travel.js')
api = api_path.read_text(encoding='utf-8')
source_anchor = 'SOURCE REQUIREMENTS — read carefully before searching:\n'
source_rules = '''SOURCE REQUIREMENTS — read carefully before searching:
- COUNTRY RULES: entry, export, transit, quarantine, health, vaccination, treatment, permit, and customs requirements MUST use the responsible government authority for that jurisdiction as the source. Do not use an airline, airport, IATA, blog, or aggregator as the authority for a country's legal requirement.
- AIRLINE/CARRIER SOURCES: use an airline or carrier's official site ONLY for that carrier's own policy (for example cabin/cargo rules, booking, carrier dimensions, breed restrictions, or service-animal procedures).
- AIRPORT SOURCES: use an airport's official site ONLY for airport-specific logistics such as pet relief areas.
- IATA may be useful as supplementary industry context but must not replace the responsible government source for a country's entry/export/transit/quarantine/health rules.
'''
api = replace_once(api, source_anchor, source_rules, 'server source hierarchy')
old_review = '''2. SOURCE QUALITY: Look at the "source_url" field. Is it an official government website (.gov, official ministry/agency site), an official airline website, or IATA? Or does it look like a third-party blog, forum, "top tips" site, or other unofficial/aggregator source?

If an item fails EITHER check — you're not confident it's accurate, OR the source doesn't look official — append " (⚠️ Verify before travel)" to that item's "title" field.'''
new_review = '''2. SOURCE QUALITY AND SCOPE: Check both the domain and whether that source is authoritative for the type of requirement. Country entry/export/transit/quarantine/health/vaccination/treatment/permit/customs rules require the responsible government authority. Airline/carrier sources are acceptable only for airline_policy items. Airport sources are acceptable only for airport_logistics. IATA may be supplementary context but must not replace the government authority for a country's legal requirement. Reject blogs, forums, listicles, and aggregators.

If an item fails EITHER check — you're not confident it's accurate, OR its source is unofficial or authoritative for the wrong scope — append " (⚠️ Verify before travel)" to that item's "title" field.'''
api = replace_once(api, old_review, new_review, 'AI reviewer source scope')
api_path.write_text(api, encoding='utf-8')

print('Applied AI source hierarchy, disclosure, and claim-precision changes.')
