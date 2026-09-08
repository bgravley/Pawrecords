#!/usr/bin/env python3
from pathlib import Path
import re

marketing = Path('src/Marketing.jsx').read_text(encoding='utf-8')
travel = Path('src/Travel.jsx').read_text(encoding='utf-8')
api = Path('api/ai-travel.js').read_text(encoding='utf-8')
source_lib = Path('src/lib/sourceVerification.js').read_text(encoding='utf-8')
llms = Path('public/llms.txt').read_text(encoding='utf-8')
policy = Path('public/ai-policy.html').read_text(encoding='utf-8')
terms = Path('public/terms.html').read_text(encoding='utf-8')
sitemap = Path('public/sitemap.xml').read_text(encoding='utf-8')
robots = Path('public/robots.txt').read_text(encoding='utf-8')
index = Path('index.html').read_text(encoding='utf-8')

CANONICAL_HOST = 'https://www.yourpetpass.com'
OLD_HOST = 'https://yourpetpass.com'
INDEXABLE = {
    'index.html': '/',
    'public/blog.html': '/blog.html',
    'public/blog/dog-vaccines-before-flying.html': '/blog/dog-vaccines-before-flying.html',
    'public/blog/pet-records-when-traveling.html': '/blog/pet-records-when-traveling.html',
    'public/blog/pet-health-certificates-explained.html': '/blog/pet-health-certificates-explained.html',
    'public/blog/moving-across-country-with-pets.html': '/blog/moving-across-country-with-pets.html',
    'public/contact.html': '/contact.html',
    'public/ai-policy.html': '/ai-policy.html',
    'public/copyright.html': '/copyright.html',
    'public/privacy.html': '/privacy.html',
    'public/terms.html': '/terms.html',
    'public/use-cases/switching-vets.html': '/use-cases/switching-vets.html',
    'public/use-cases/pet-travel-documents.html': '/use-cases/pet-travel-documents.html',
    'public/use-cases/maria-and-biscuit.html': '/use-cases/maria-and-biscuit.html',
}

checks=[]
def check(ok,msg): checks.append((bool(ok),msg))

# Human-facing marketing claims.
check('AI extracts details for you to review' in marketing,
      'marketing describes AI document extraction as reviewable, not automatically authoritative')
check('generated in seconds' not in marketing and 'extracts and saves it automatically' not in marketing,
      'marketing no longer uses the two over-broad AI automation claims')
check('official-source links, then verify current rules before travel' in marketing,
      'marketing tells travelers to verify current rules')
check('/ai-policy.html' in marketing and 'AI & Sources' in marketing,
      'homepage links to the public AI and source policy')

# Server-side source hierarchy and review boundaries.
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

# Crawler/LLM description must have the same limitations and privacy boundary.
check('AI output is a planning and organization aid, not veterinary care or official travel approval.' in llms,
      'LLM-facing product description includes AI limitation')
check(f'AI & Source Policy: {CANONICAL_HOST}/ai-policy.html' in llms,
      'LLM-facing description links to canonical AI policy')
check('when enabled, creates a tokenized, no-login emergency page with owner-selected supported fields' in llms and
      'it is not a public pet directory and does not expose full medical records or private uploaded documents' in llms,
      'LLM-facing Emergency QR description preserves owner control and privacy boundary')

check('AI output is a starting point, not an official approval, veterinary diagnosis, or guarantee' in policy,
      'public AI policy states core limitation plainly')
check('the source should be the responsible government authority for that jurisdiction' in policy,
      'public AI policy explains country-source hierarchy')
check("an airline or carrier source is used only for that carrier's own policy" in policy,
      'public AI policy explains carrier-source boundary')
check('Researched is not the same as verified' in policy,
      'public AI policy explains review-status distinction')
check("don't rely solely on" in terms and
      'AI-generated travel checklists for legal compliance' in terms and
      'AI-generated travel checklists are provided as a planning aid only.' in terms and
      'You are solely responsible for verifying all requirements with the relevant government agencies, airlines, and veterinary authorities before traveling.' in terms,
      'Terms require independent verification and prohibit sole reliance on AI travel output')

# Canonical-domain consistency: production permanently serves www, so every
# indexable page and crawler discovery surface must point at that same host.
for path, route in INDEXABLE.items():
    text = Path(path).read_text(encoding='utf-8')
    expected = f'<link rel="canonical" href="{CANONICAL_HOST}{route}" />'
    check(text.count('rel="canonical"') == 1 and expected in text,
          f'{path} has exactly one canonical URL on the production www host')
    check(OLD_HOST not in text,
          f'{path} contains no stale non-www absolute URL')

sitemap_locs = re.findall(r'<loc>([^<]+)</loc>', sitemap)
check(len(sitemap_locs) == len(INDEXABLE),
      'sitemap lists exactly the indexable public page set')
check(all(url.startswith(CANONICAL_HOST + '/') for url in sitemap_locs),
      'every sitemap URL uses the production www host')
check(all(f'{CANONICAL_HOST}{route}' in sitemap_locs for route in INDEXABLE.values()),
      'sitemap contains every canonical indexable route')
check(f'Sitemap: {CANONICAL_HOST}/sitemap.xml' in robots and OLD_HOST not in robots,
      'robots.txt advertises the canonical www sitemap')
check(OLD_HOST not in llms,
      'llms.txt contains no stale non-www absolute URL')
check(f'- Homepage: {CANONICAL_HOST}' in llms,
      'llms.txt identifies the production www homepage')

# Root metadata/structured data and crawler-only fallback must not resurrect old
# or broader claims than the human-facing product.
check(f'<link rel="canonical" href="{CANONICAL_HOST}/" />' in index and
      f'<meta property="og:url" content="{CANONICAL_HOST}/" />' in index and
      f'<meta name="twitter:url" content="{CANONICAL_HOST}/" />' in index,
      'root canonical, Open Graph, and Twitter URLs agree on www')
check('"operatingSystem": "Web"' in index and '"operatingSystem": "Web, iOS, Android"' not in index,
      'structured data does not imply native iOS/Android availability before launch')
check('uses AI to help extract information from uploaded vet documents for review' in index,
      'structured data describes document AI as reviewable assistance')
check('AI-assisted route-specific travel planning checklists with official-source links' in index,
      'structured data describes travel AI as planning assistance with sources')
check('owner-controlled tokenized Emergency QR page' in index,
      'structured data describes Emergency QR as owner controlled')
check('automatically extracts and saves' not in index and 'scans vet documents automatically using AI' not in index,
      'crawler-facing root copy removes automatic-save AI claims')
check('Every pet gets a QR code' not in index and 'public emergency health page' not in index,
      'crawler-facing root copy removes universal/public-directory Emergency QR implication')
check('The extracted information is presented\n          for you to review before you rely on it or save it to your pet\'s profile.' in index,
      'crawler fallback requires review before relying on or saving extracted information')
check('If you enable Emergency QR for a pet, it creates a tokenized, no-login emergency' in index and
      'It is not a public pet\n          directory and does not expose the pet\'s full medical record or private uploaded documents.' in index,
      'crawler fallback matches the Emergency QR privacy boundary')
check('Country entry, export, transit, quarantine, health, vaccination, treatment, permit,' in index and
      'should point to the responsible government authority' in index and
      'Confirm current requirements before travel.' in index,
      'crawler fallback carries government-source and verification guidance')

failed=[msg for ok,msg in checks if not ok]
for ok,msg in checks: print(('PASS' if ok else 'FAIL')+': '+msg)
if failed: raise SystemExit(f'{len(failed)} AI claims/source/canonical audit check(s) failed')
print(f'AI claims/source/canonical audit passed: {len(checks)}/{len(checks)} checks')
