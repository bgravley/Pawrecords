#!/usr/bin/env python3
from pathlib import Path

path = Path('scripts/live_smoke.mjs')
text = path.read_text(encoding='utf-8')

helper_anchor = '''async function expectVisibleText(page, text, timeout = 15000) {\n  await page.getByText(text, { exact: false }).first().waitFor({ state: 'visible', timeout });\n}\n'''
helper = helper_anchor + r'''
async function assertAccessibleControls(page, label) {
  const problems = await page.evaluate(() => {
    const visible = element => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) !== 0 && rect.width > 0 && rect.height > 0;
    };
    const textForId = id => document.getElementById(id)?.textContent?.trim() || '';
    const named = element => {
      const aria = element.getAttribute('aria-label')?.trim();
      if (aria) return true;
      const labelledBy = element.getAttribute('aria-labelledby')?.trim();
      if (labelledBy && labelledBy.split(/\s+/).some(id => textForId(id))) return true;
      if (element.getAttribute('title')?.trim()) return true;
      if (element.textContent?.trim()) return true;
      if (element instanceof HTMLInputElement && ['submit', 'button', 'reset'].includes(element.type) && element.value?.trim()) return true;
      return false;
    };
    const hasFormLabel = element => {
      if (element.getAttribute('aria-label')?.trim()) return true;
      const labelledBy = element.getAttribute('aria-labelledby')?.trim();
      if (labelledBy && labelledBy.split(/\s+/).some(id => textForId(id))) return true;
      if (element.closest('label')) return true;
      if (element.id && document.querySelector(`label[for="${CSS.escape(element.id)}"]`)) return true;
      return false;
    };
    const describe = element => {
      const tag = element.tagName.toLowerCase();
      const role = element.getAttribute('role');
      const text = element.textContent?.trim().replace(/\s+/g, ' ').slice(0, 60) || '';
      return `${tag}${role ? `[role=${role}]` : ''}${text ? ` "${text}"` : ''}`;
    };

    const issues = [];
    document.querySelectorAll('button,[role="button"],a[href]').forEach(element => {
      if (visible(element) && !named(element)) issues.push(`unnamed interactive control: ${describe(element)}`);
    });
    document.querySelectorAll('input:not([type="hidden"]),select,textarea').forEach(element => {
      if (visible(element) && !hasFormLabel(element)) issues.push(`unlabeled form control: ${describe(element)}`);
    });
    document.querySelectorAll('[role="dialog"]').forEach(element => {
      if (!visible(element)) return;
      if (element.getAttribute('aria-modal') !== 'true') issues.push('visible dialog missing aria-modal=true');
      if (!named(element)) issues.push('visible dialog missing accessible name');
    });
    return issues.slice(0, 20);
  });
  if (problems.length) throw new Error(`${label} accessibility problems: ${problems.join(' | ')}`);
}
'''
if 'async function assertAccessibleControls(page, label)' not in text:
    if helper_anchor not in text:
        raise SystemExit('Could not locate smoke helper anchor')
    text = text.replace(helper_anchor, helper, 1)

replacements = [
    (
        "      await chooseEssentialAnalytics(page);\n      primarySession = await readBrowserSession(page);",
        "      await chooseEssentialAnalytics(page);\n      await assertAccessibleControls(page, 'My Pets first-run screen');\n      primarySession = await readBrowserSession(page);",
        'first-run accessibility check',
    ),
    (
        "      const modal = await modalFor(page, 'Add Pet');\n      await (await fieldControl(modal, 'Name')).fill(PET_NAME);",
        "      const modal = await modalFor(page, 'Add Pet');\n      await assertAccessibleControls(page, 'Add Pet dialog');\n      await (await fieldControl(modal, 'Name')).fill(PET_NAME);",
        'Add Pet accessibility check',
    ),
    (
        "      await rabies.waitFor({ state: 'visible', timeout: 15000 });\n\n      const card = rabies.locator('xpath=../..');",
        "      await rabies.waitFor({ state: 'visible', timeout: 15000 });\n      await assertAccessibleControls(page, 'Vaccination record controls');\n\n      const card = rabies.locator('xpath=../..');",
        'vaccination accessibility check',
    ),
    (
        "      await page.getByText(DOC_NAME, { exact: true }).waitFor({ state: 'visible', timeout: 15000 });\n\n      const docCard",
        "      await page.getByText(DOC_NAME, { exact: true }).waitFor({ state: 'visible', timeout: 15000 });\n      await assertAccessibleControls(page, 'Document record controls');\n\n      const docCard",
        'document accessibility check',
    ),
    (
        "      const modal = await modalFor(page, 'Plan New Trip');\n      await (await fieldControl(modal, 'Trip Name (optional)')).fill(TRIP_NAME);",
        "      const modal = await modalFor(page, 'Plan New Trip');\n      await assertAccessibleControls(page, 'Plan New Trip dialog');\n      await (await fieldControl(modal, 'Trip Name (optional)')).fill(TRIP_NAME);",
        'travel accessibility check',
    ),
    (
        "      await chooseEssentialAnalytics(page);\n      await expectVisibleText(page, 'Welcome to YourPetPass');",
        "      await chooseEssentialAnalytics(page);\n      await assertAccessibleControls(page, 'Secondary customer first-run screen');\n      await expectVisibleText(page, 'Welcome to YourPetPass');",
        'secondary accessibility check',
    ),
]

for old, new, label in replacements:
    if new in text:
        continue
    if old not in text:
        raise SystemExit(f'Could not locate {label}')
    text = text.replace(old, new, 1)

path.write_text(text, encoding='utf-8')
print('Added browser-rendered accessibility checks to production smoke.')
