#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

COLOR_MAP = {
    '#2D7D6F': '#2C4A38',
    '#1E5C52': '#2C4A38',
    '#FAF6F0': '#FAFCFB',
    '#F4EFE8': '#EAF4EE',
    '#E8DDD0': '#DCE8E0',
    '#2C2017': '#1A2E22',
    '#5A4535': '#5C7464',
    '#8B7355': '#7C9E87',
    '#E8A838': '#C9A84C',
    '#F5C45E': '#C9A84C',
    '#A8D5CE': '#9DC4AA',
    '#4A9E90': '#9DC4AA',
    '#C4714A': '#A8583E',
    '#C8E8E4': '#DDE9E1',
    '#F0E8DC': '#EAF4EE',
}

APP_FILES = [
    'src/App.jsx',
    'src/Travel.jsx',
    'src/AffiliatePortal.jsx',
]

PUBLIC_EDITORIAL = [
    'public/blog.html',
    'public/use-cases/switching-vets.html',
    'public/use-cases/maria-and-biscuit.html',
    'public/use-cases/pet-travel-documents.html',
    'public/blog/pet-records-when-traveling.html',
    'public/blog/dog-vaccines-before-flying.html',
    'public/blog/moving-across-country-with-pets.html',
]


def replace_colors(text):
    for old, new in COLOR_MAP.items():
        text = text.replace(old, new)
        text = text.replace(old.lower(), new.lower())
    text = text.replace('rgba(44,32,23', 'rgba(26,46,34')
    text = text.replace('rgba(44, 32, 23', 'rgba(26, 46, 34')
    return text


def write_if_changed(path, transform):
    p = ROOT / path
    before = p.read_text(encoding='utf-8')
    after = transform(before)
    if after == before:
        raise SystemExit(f'{path}: patch produced no changes')
    p.write_text(after, encoding='utf-8')
    print(f'updated {path}')


def app_transform(text):
    text = replace_colors(text)
    text = text.replace("'Nunito', sans-serif", "'Lora', serif")
    text = text.replace("'Nunito',sans-serif", "'Lora',serif")
    return text


def editorial_transform(text):
    # Existing Lora on these legacy pages was used for headlines/logo text.
    # Move that headline layer to Playfair before converting Nunito body copy to Lora.
    text = text.replace("font-family:'Lora',serif", "font-family:'Playfair Display',serif")
    text = text.replace("font-family: 'Lora', serif", "font-family: 'Playfair Display', serif")
    text = text.replace(
        'family=Lora:ital,wght@0,400;0,600;1,400&family=Nunito:wght@400;600;700&display=swap',
        'family=Lora:ital,wght@0,400;0,600;1,400&family=Playfair+Display:wght@700;800&display=swap',
    )
    text = text.replace("font-family:'Nunito',sans-serif", "font-family:'Lora',serif")
    text = text.replace("font-family: 'Nunito', sans-serif", "font-family: 'Lora', serif")
    text = replace_colors(text)
    return text


for path in APP_FILES:
    write_if_changed(path, app_transform)

for path in PUBLIC_EDITORIAL:
    write_if_changed(path, editorial_transform)


def notification_transform(text):
    text = replace_colors(text)
    text = text.replace("body { font-family: 'Georgia', serif;", "body { font-family: 'Lora', Georgia, serif;")
    text = text.replace("h2 { color: #2C4A38;", "h2 { font-family: 'Playfair Display', Georgia, serif; color: #2C4A38;")
    return text

write_if_changed('api/send-notifications.js', notification_transform)
