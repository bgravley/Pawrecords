#!/usr/bin/env python3
from pathlib import Path

marketing = Path('src/Marketing.jsx').read_text(encoding='utf-8')
travel = Path('src/Travel.jsx').read_text(encoding='utf-8')
api = Path('api/ai-travel.js').read_text(encoding='utf-8')
source_lib = Path('src/lib/sourceVerification.js').read_text(encoding='utf-8')
llms = Path('public/llms.txt').read_text(encoding='utf-8')
policy = Path('public/ai-policy.html').read_text(encoding='utf-8')
terms = Path('public/terms.html').read_text(encoding='utf-8')
sitemap = Path('public/sitemap.xml').read_text(encoding='utf-8')

checks=[]
def check(ok,msg): checks.append((bool(ok),msg))

check('AI extracts details for you to review' in marketing,
      'marketing describes AI document extraction as reviewable, not automatically authoritative')
check('generated in seconds' not in marketing and 'extracts and saves it automatically' not in marketing,
      'marketing no longer uses the two over-broad AI automation claims')
check('official-source links, then verify current rules before travel' in marketing,
      'marketing tells travelers to verify current rules')
check('/ai-policy.html' in marketing and 'AI & Sources' in marketing,
      'homepage links to the public AI and source policy')

check('COUNTRY RULES: entry, export, transit, quarantine, health, vaccination, treatment, permit, and customs requirements MUST use the responsible government authority' in api,
      'server research prompt requires government authority for country rules')
check("AIRLINE/CARRIER SOURCES: use an airline or carrier's official site ONLY for that carrier's own policy" in api,
      'server prompt limits carrier sources to carrier policy')
check("AIRPORT SOURCES: use an airport's official site ONLY for airport-specific logistics" in api,
      'server prompt limits airport sources to airport logistics')
check('IATA may be useful as supplementary industry context but must not replace the responsible government source' in api,
      'server prompt does not allow IATA to replace country government authority')
check('SOURCE QUALITY AND SCOPE' in api and 'Airline/carrier sources are acceptable only for airline_policy items' in api,
      'second-model review checks source scope as well as apparent source quality')

check("last_verified_at: null,\n        researched_at: now," in travel,
      'new AI research does not self-assign a human verification timestamp')
check('item.human_review_status === "verified" && item.last_verified_at' in travel,
      'travel UI only displays human-verified date when review status is verified')
check('Researched ${new Date(item.researched_at).toLocaleDateString()}' in travel,
      'travel UI labels AI research time as Researched')
check("'<br><small>Researched ' + new Date(i.researched_at).toLocaleDateString()" in travel,
      'exported travel checklist labels AI source date as Researched')
check("'<br><small>Checked ' + new Date(i.researched_at).toLocaleDateString()" not in travel,
      'export cannot imply that AI research alone was a verification check')
check('AI-assisted planning only. Country rules should link to the responsible government authority.' in travel,
      'travel checklist carries an in-context AI planning disclosure')
check('Country entry/export/transit/quarantine/health requirements MUST use source_type government' in travel,
      'client prompt independently enforces government source type for country requirements')
check('if (item.requirement_type === "airline_policy" || item.category === "airline") return "airline";' in source_lib and
      'if (item.requirement_type === "airport_logistics") return "airport";' in source_lib and
      'return "government";' in source_lib,
      'runtime source-type expectations default legal requirements to government')
check('Official source — review pending' in source_lib and 'Human verified' in source_lib,
      'runtime distinguishes review-pending from human-verified sources')

check('AI output is a planning and organization aid, not veterinary care or official travel approval.' in llms,
      'LLM-facing product description includes AI limitation')
check('AI & Source Policy: https://yourpetpass.com/ai-policy.html' in llms,
      'LLM-facing description links to AI policy')
check('AI output is a starting point, not an official approval, veterinary diagnosis, or guarantee' in policy,
      'public AI policy states core limitation plainly')
check('the source should be the responsible government authority for that jurisdiction' in policy,
      'public AI policy explains country-source hierarchy')
check("an airline or carrier source is used only for that carrier's own policy" in policy,
      'public AI policy explains carrier-source boundary')
check('Researched is not the same as verified' in policy,
      'public AI policy explains review-status distinction')
check('do not rely solely on our AI-generated travel checklists for legal compliance' in terms,
      'Terms already warn against sole reliance on AI travel output')
check('https://yourpetpass.com/ai-policy.html' in sitemap,
      'AI policy is included in sitemap')

failed=[msg for ok,msg in checks if not ok]
for ok,msg in checks: print(('PASS' if ok else 'FAIL')+': '+msg)
if failed: raise SystemExit(f'{len(failed)} AI claims/source audit check(s) failed')
print(f'AI claims/source audit passed: {len(checks)}/{len(checks)} checks')
