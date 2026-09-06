#!/usr/bin/env python3
from pathlib import Path

path = Path('scripts/live_smoke.mjs')
text = path.read_text(encoding='utf-8')
old = '''async function fieldControl(root, labelText, selector = 'input') {
  const label = root.locator('label').filter({ hasText: labelText }).first();
  await label.waitFor({ state: 'visible', timeout: 10000 });
  const control = label.locator('..').locator(selector).first();
  await control.waitFor({ state: 'attached', timeout: 10000 });
  return control;
}
'''
new = '''async function fieldControl(root, labelText, selector = 'input') {
  const label = root.locator('label').filter({ hasText: labelText }).first();
  await label.waitFor({ state: 'visible', timeout: 10000 });

  // Accessible Field components now wrap their form control in the label.
  // Prefer that exact association so a fill cannot drift to another input in
  // the surrounding grid. Keep the parent fallback for older forms whose
  // visible label and control are siblings.
  const nested = label.locator(selector).first();
  if (await nested.count()) {
    await nested.waitFor({ state: 'attached', timeout: 10000 });
    return nested;
  }

  const control = label.locator('..').locator(selector).first();
  await control.waitFor({ state: 'attached', timeout: 10000 });
  return control;
}
'''
if new in text:
    print('Smoke field locator already updated')
elif old in text:
    path.write_text(text.replace(old, new, 1), encoding='utf-8')
    print('Updated smoke field locator for nested accessible labels')
else:
    raise SystemExit('Could not locate fieldControl helper')
