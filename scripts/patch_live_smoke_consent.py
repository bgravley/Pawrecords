#!/usr/bin/env python3
from pathlib import Path

path = Path('scripts/live_smoke.mjs')
text = path.read_text(encoding='utf-8')

helper_anchor = """async function expectVisibleText(page, text, timeout = 15000) {\n  await page.getByText(text, { exact: false }).first().waitFor({ state: 'visible', timeout });\n}\n"""
helper = helper_anchor + """\nasync function chooseEssentialAnalytics(page) {\n  const essential = page.getByRole('button', { name: 'Essential only', exact: true });\n  try {\n    await essential.waitFor({ state: 'visible', timeout: 5000 });\n  } catch {\n    // A stored privacy choice means the first-visit dialog is intentionally absent.\n    return;\n  }\n\n  await essential.click();\n  const stored = await page.evaluate(() => localStorage.getItem('ypp_analytics_consent_v1'));\n  if (stored !== 'denied') throw new Error(`Essential-only analytics preference was not stored (got ${stored})`);\n  await page.getByRole('button', { name: 'Open privacy choices', exact: true }).waitFor({ state: 'visible', timeout: 5000 });\n}\n"""

if 'async function chooseEssentialAnalytics(page)' not in text:
    if helper_anchor not in text:
        raise SystemExit('Could not locate expectVisibleText helper anchor')
    text = text.replace(helper_anchor, helper, 1)

public_anchor = """  const response = await publicPage.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });\n  if (!response || response.status() !== 200) throw new Error(`Homepage returned ${response?.status()}`);\n  await publicPage.getByRole('button', { name: 'Login' }).waitFor({ state: 'visible', timeout: 15000 });\n"""
public_replacement = """  const response = await publicPage.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });\n  if (!response || response.status() !== 200) throw new Error(`Homepage returned ${response?.status()}`);\n  await chooseEssentialAnalytics(publicPage);\n  await publicPage.getByRole('button', { name: 'Login' }).waitFor({ state: 'visible', timeout: 15000 });\n"""
if 'await chooseEssentialAnalytics(publicPage);' not in text:
    if public_anchor not in text:
        raise SystemExit('Could not locate public homepage anchor')
    text = text.replace(public_anchor, public_replacement, 1)

primary_anchor = """      await loginWithActionLink(page, primary.actionLink);\n      primarySession = await readBrowserSession(page);\n"""
primary_replacement = """      await loginWithActionLink(page, primary.actionLink);\n      await chooseEssentialAnalytics(page);\n      primarySession = await readBrowserSession(page);\n"""
if 'await loginWithActionLink(page, primary.actionLink);\n      await chooseEssentialAnalytics(page);' not in text:
    if primary_anchor not in text:
        raise SystemExit('Could not locate primary login anchor')
    text = text.replace(primary_anchor, primary_replacement, 1)

secondary_anchor = """      await loginWithActionLink(page, secondary.actionLink);\n      await expectVisibleText(page, 'Welcome to YourPetPass');\n"""
secondary_replacement = """      await loginWithActionLink(page, secondary.actionLink);\n      await chooseEssentialAnalytics(page);\n      await expectVisibleText(page, 'Welcome to YourPetPass');\n"""
if 'await loginWithActionLink(page, secondary.actionLink);\n      await chooseEssentialAnalytics(page);' not in text:
    if secondary_anchor not in text:
        raise SystemExit('Could not locate secondary login anchor')
    text = text.replace(secondary_anchor, secondary_replacement, 1)

required = [
    'async function chooseEssentialAnalytics(page)',
    'await chooseEssentialAnalytics(publicPage);',
    'await loginWithActionLink(page, primary.actionLink);\n      await chooseEssentialAnalytics(page);',
    'await loginWithActionLink(page, secondary.actionLink);\n      await chooseEssentialAnalytics(page);',
]
for needle in required:
    if needle not in text:
        raise SystemExit(f'Missing expected patched content: {needle}')

path.write_text(text, encoding='utf-8')
print('Patched scripts/live_smoke.mjs to exercise Essential only before customer interactions.')
