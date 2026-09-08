#!/usr/bin/env python3
from pathlib import Path
import re

for name in ["public/terms.html", "public/privacy.html", "public/contact.html"]:
    path = Path(name)
    text = path.read_text(encoding="utf-8")
    text, n = re.subn(r"(--teal-dk:\s*)#1A2E22", r"\1#2C4A38", text)
    if n != 1:
        raise SystemExit(f"{name}: expected one dark-brand variable, found {n}")
    path.write_text(text, encoding="utf-8")

privacy = Path("public/privacy.html")
text = privacy.read_text(encoding="utf-8")
for old, new, label in [
    ("header a {\n      font-family: 'Lora', serif;", "header a {\n      font-family: 'Playfair Display', serif;", "privacy header font"),
    (".hero h1 {\n      font-family: 'Lora', serif;", ".hero h1 {\n      font-family: 'Playfair Display', serif;", "privacy hero font"),
    ("h2 {\n      font-family: 'Lora', serif;", "h2 {\n      font-family: 'Playfair Display', serif;", "privacy heading font"),
]:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected one match, found {count}")
    text = text.replace(old, new, 1)
text = text.replace("font-weight: 600;", "font-weight: 700;", 3)
privacy.write_text(text, encoding="utf-8")

for name in ["public/terms.html", "public/contact.html"]:
    path = Path(name)
    text = path.read_text(encoding="utf-8")
    text = text.replace("font-family: 'Playfair Display', serif; font-size: 22px; color: #fff; text-decoration: none; font-weight: 600;",
                        "font-family: 'Playfair Display', serif; font-size: 22px; color: #fff; text-decoration: none; font-weight: 700;")
    text = text.replace("font-family: 'Playfair Display', serif; font-size: clamp(26px, 5vw, 38px); font-weight: 600;",
                        "font-family: 'Playfair Display', serif; font-size: clamp(26px, 5vw, 38px); font-weight: 700;")
    text = text.replace("font-family: 'Playfair Display', serif; font-size: clamp(28px, 5vw, 40px); font-weight: 600;",
                        "font-family: 'Playfair Display', serif; font-size: clamp(28px, 5vw, 40px); font-weight: 700;")
    text = text.replace("h2 { font-family: 'Playfair Display', serif; font-size: 20px; font-weight: 600;",
                        "h2 { font-family: 'Playfair Display', serif; font-size: 20px; font-weight: 700;")
    path.write_text(text, encoding="utf-8")

print("Corrected legal-page Forest Green backgrounds and Playfair Bold headings.")
