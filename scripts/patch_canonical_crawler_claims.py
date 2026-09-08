#!/usr/bin/env python3
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
HOST = 'https://www.yourpetpass.com'
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


def read(path):
    return (ROOT / path).read_text(encoding='utf-8')


def write(path, text):
    (ROOT / path).write_text(text, encoding='utf-8')
    print(f'updated {path}')


def ensure_canonical(path, route):
    text = read(path).replace(OLD_HOST, HOST)
    canonical = f'{HOST}{route}'
    if 'rel="canonical"' in text:
        text, n = re.subn(
            r'<link\s+rel="canonical"\s+href="[^"]+"\s*/?>',
            f'<link rel="canonical" href="{canonical}" />',
            text,
            count=1,
        )
        if n != 1:
            raise SystemExit(f'{path}: expected one canonical tag replacement, got {n}')
    else:
        m = re.search(r'(^[ \t]*<meta\s+name="description"[^>]*?/?>\s*$)', text, flags=re.M)
        if not m:
            raise SystemExit(f'{path}: no meta description anchor for canonical insertion')
        indent = re.match(r'^[ \t]*', m.group(1)).group(0)
        text = text[:m.end()] + f'\n{indent}<link rel="canonical" href="{canonical}" />' + text[m.end():]
    if text.count('rel="canonical"') != 1:
        raise SystemExit(f'{path}: canonical tag count is not exactly one')
    write(path, text)


for path, route in INDEXABLE.items():
    ensure_canonical(path, route)

# Keep all crawler discovery surfaces on the same host that production serves.
for path in ['public/sitemap.xml', 'public/robots.txt', 'public/llms.txt']:
    text = read(path).replace(OLD_HOST, HOST)
    write(path, text)

# Correct the root document's crawler-only and structured-data claims so they
# match the current human-facing product and public AI/Emergency policies.
path = 'index.html'
text = read(path)
replacements = {
    "YourPetPass keeps your dog or cat's vaccine records, vet visits, allergies, and medications organized in one place — accessible from any vet, anywhere. Generate AI-powered travel checklists for flying, driving, or any trip with your pet, scan vet documents automatically, and share an emergency QR health card. Free to start.":
    "YourPetPass keeps your dog or cat's health records organized in one place, uses AI to help extract details from uploaded vet documents for review, and creates AI-assisted travel planning checklists with official-source links. Free to start.",
    '"operatingSystem": "Web, iOS, Android"': '"operatingSystem": "Web"',
    "YourPetPass is a pet health records and travel planning app for dog and cat parents. It stores vaccination history, vet visit records, allergies, and medications in one place, generates AI-powered travel requirement checklists for flying, driving, or any trip with your dog or cat, scans vet documents automatically using AI, and provides a QR-code emergency health card.":
    "YourPetPass is a pet health records and travel planning app for dog and cat parents. It stores vaccination history, vet visit records, allergies, and medications in one place, uses AI to help extract information from uploaded vet documents for review, creates AI-assisted route-specific travel planning checklists with official-source links, and can provide an owner-controlled tokenized Emergency QR page.",
    "Yes. YourPetPass generates a route-specific AI travel checklist covering health certificates, vaccination requirements, and airline pet policies for both domestic and international trips.":
    "Yes. YourPetPass can create a route-specific AI-assisted travel planning checklist with official-source links. Country requirements should be confirmed with the responsible government authority, and carrier-specific policies should be confirmed separately with the carrier.",
    "<h1>YourPetPass — Your Dog's Health Records, Organized and Travel-Ready</h1>":
    "<h1>YourPetPass — Your Pet's Health Records, Organized and Travel-Ready</h1>",
    "          Generate a route-specific checklist covering health certificates, vaccination\n          requirements, and airline pet policies for both domestic and international travel.\n          YourPetPass uses AI to research current requirements and flags anything that should\n          be double-checked before you fly.":
    "          Create a route-specific AI-assisted planning checklist with official-source links.\n          Country entry, export, transit, quarantine, health, vaccination, treatment, permit,\n          and customs rules should point to the responsible government authority. Carrier sources\n          are used for carrier-specific policy. Confirm current requirements before travel.",
    "          Take a photo of any vet record, vaccine certificate, or health document and\n          YourPetPass automatically extracts and saves the information to your pet's profile.":
    "          Take a photo of a vet record, vaccine certificate, or health document and\n          YourPetPass can use AI to extract useful details. The extracted information is presented\n          for you to review before you rely on it or save it to your pet's profile.",
    "          Every pet gets a QR code linking to a public emergency health page — no login\n          required — showing allergies, emergency contact info, and vaccination status.\n          Useful for boarding, daycare, pet-sitters, or if a pet is ever lost.":
    "          If you enable Emergency QR for a pet, it creates a tokenized, no-login emergency\n          page. You choose which supported emergency fields are shared. It is not a public pet\n          directory and does not expose the pet's full medical record or private uploaded documents.",
}
for old, new in replacements.items():
    if old not in text:
        raise SystemExit(f'index.html: expected claim anchor not found: {old[:80]!r}')
    text = text.replace(old, new, 1)
write(path, text)

# Keep llms.txt equally precise about the Emergency QR privacy boundary.
path = 'public/llms.txt'
text = read(path)
llm_replacements = {
    '> AI-assisted travel planning checklists with source links, and provides a QR-code emergency health card.':
    '> AI-assisted travel planning checklists with source links, and can provide an owner-controlled tokenized Emergency QR page.',
    '- QR emergency health card: a public, no-login page for sitters, boarding facilities, or lost-pet situations':
    '- QR emergency health card: when enabled, creates a tokenized, no-login emergency page with owner-selected supported fields; it is not a public pet directory and does not expose full medical records or private uploaded documents',
}
for old, new in llm_replacements.items():
    if old not in text:
        raise SystemExit(f'llms.txt: expected claim anchor not found: {old!r}')
    text = text.replace(old, new, 1)
write(path, text)
