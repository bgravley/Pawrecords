from pathlib import Path

path = Path('src/PawRecord.jsx')
text = path.read_text(encoding='utf-8')
original = text

# Replace the legacy authenticated-app palette with the current YourPetPass
# customer-facing palette already used by Marketing/Auth/Emergency.
replacements = {
    '#1E5C52': '#2C4A38',  # legacy dark teal -> Forest Green
    '#2D7D6F': '#2C4A38',  # legacy teal accent -> Forest Green
    '#FAF6F0': '#FAFCFB',  # beige page background -> Warm White
    '#F4EFE8': '#EAF4EE',  # beige panel -> Mint Cream
    '#E8DDD0': '#DCE8E0',  # beige border -> sage-tinted border
    '#2C2017': '#1A2E22',  # brown-black -> Deep Text
    '#5A4535': '#385744',  # brown body text -> deep green body text
    '#8B7355': '#6A8372',  # brown muted text -> muted sage
    '#E8A838': '#C9A84C',  # legacy amber -> Gold
    '#F5C45E': '#C9A84C',  # legacy yellow -> Gold
    '#A8D5CE': '#9DC4AA',  # legacy light teal -> Light Sage
}
for old, new in replacements.items():
    text = text.replace(old, new).replace(old.lower(), new)

# The legacy app was the only customer-facing surface still using Nunito.
# Load the brand fonts and use Lora for body/control copy.
old_import = "@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Lora:ital,wght@0,400;0,600;1,400;1,600&display=swap');"
new_import = "@import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;1,400;1,600&family=Playfair+Display:wght@700;800&display=swap');"
if old_import in text:
    text = text.replace(old_import, new_import, 1)
elif new_import not in text:
    raise SystemExit('PawRecord font import anchor changed')

text = text.replace("'Nunito',sans-serif", "'Lora',serif")
text = text.replace("'Nunito', sans-serif", "'Lora', serif")
text = text.replace('Nunito', 'Lora')

# Give semantic headings the brand display face. Many app section labels are
# still divs and remain Lora; this keeps the first refresh low-risk rather than
# mechanically restyling every component title.
heading_rule = "  h1,h2,h3{font-family:'Playfair Display',serif}\n"
anchor = "  body{background:#FAFCFB;color:#1A2E22;font-family:'Lora',serif;font-size:15px;-webkit-font-smoothing:antialiased}\n"
if heading_rule not in text:
    if anchor not in text:
        raise SystemExit('PawRecord global body style anchor changed')
    text = text.replace(anchor, anchor + heading_rule, 1)

if text == original:
    print('Brand refresh already applied')
else:
    path.write_text(text, encoding='utf-8')
    print('Updated PawRecord to current YourPetPass brand palette and fonts')
