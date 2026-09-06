#!/usr/bin/env python3
from pathlib import Path

path = Path('scripts/live_smoke.mjs')
text = path.read_text(encoding='utf-8')

anchor = """    await step('Pet can be created through the production UI', async () => {\n"""
block = """    await step('Feedback UI offers bug, feature, and general feedback paths', async () => {\n      const launcher = page.getByRole('button', { name: 'Share feedback', exact: true }).first();\n      await launcher.waitFor({ state: 'visible', timeout: 10000 });\n      await launcher.click();\n\n      const modal = await modalFor(page, '💬 Share Feedback');\n      await assertAccessibleControls(page, 'Share Feedback modal');\n      const typeSelect = await fieldControl(modal, 'What would you like to share?', 'select');\n      const options = await typeSelect.locator('option').allTextContents();\n      for (const expected of ['Report a bug', 'Request a feature', 'Share general feedback']) {\n        if (!options.includes(expected)) throw new Error(`Feedback type option missing: ${expected}`);\n      }\n      await typeSelect.selectOption('feature');\n      await modal.getByText('What would you like us to add?', { exact: true }).waitFor({ state: 'visible', timeout: 5000 });\n      await modal.getByRole('button', { name: /close/i }).first().click();\n    });\n\n"""

if block.strip() in text:
    print('Feedback smoke block already present.')
elif anchor in text:
    text = text.replace(anchor, block + anchor, 1)
    path.write_text(text, encoding='utf-8')
    print('Added feedback modal production smoke coverage.')
else:
    raise SystemExit('Could not locate pet-creation smoke anchor')
