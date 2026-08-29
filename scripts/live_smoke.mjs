import { chromium } from 'playwright';

const BASE = (process.env.E2E_BASE_URL || 'https://yourpetpass.com').replace(/\/$/, '');
const E2E_EMAIL = process.env.E2E_EMAIL || '';
const E2E_PASSWORD = process.env.E2E_PASSWORD || '';
const INVALID_EMERGENCY_TOKEN = 'livesmokeinvalidtoken9f8e7d6c';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  userAgent: 'YourPetPass-Live-Smoke/1.0',
});
const page = await context.newPage();
const failures = [];

page.on('pageerror', (error) => {
  failures.push(`Browser page error: ${error.message}`);
});

async function check(name, fn) {
  try {
    await fn();
    console.log(`PASS: ${name}`);
  } catch (error) {
    failures.push(`${name}: ${error.message}`);
    console.error(`FAIL: ${name}`);
  }
}

async function expectVisibleText(text, timeout = 10000) {
  await page.getByText(text, { exact: false }).first().waitFor({ state: 'visible', timeout });
}

await check('Homepage renders the interactive marketing experience', async () => {
  const response = await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
  if (!response || response.status() !== 200) throw new Error(`Homepage returned ${response?.status()}`);
  await page.getByRole('button', { name: 'Login' }).waitFor({ state: 'visible', timeout: 15000 });
  const title = await page.title();
  if (!title.includes('YourPetPass')) throw new Error(`Unexpected title: ${title}`);
  await expectVisibleText('One place for every vet visit, vaccine, and trip your pet takes.');
});

await check('Authentication UI renders and uses the secured emergency-access explanation', async () => {
  await page.getByRole('button', { name: 'Login' }).click();
  await expectVisibleText("Your pet's records belong with you.");
  await page.getByRole('button', { name: 'Create Account' }).click();
  await page.getByPlaceholder(/Password \(min \d+ characters\)/).waitFor({ state: 'visible' });

  await page.getByRole('button', { name: 'Have an emergency QR code?' }).click();
  await expectVisibleText('There is no public directory of pets or medical records.');

  const body = await page.locator('body').innerText();
  if (body.includes('Select the pet to view their health record.')) {
    throw new Error('Legacy public-pet lookup copy is still present');
  }
});

await check('Invalid Emergency QR token reveals no record', async () => {
  const response = await page.goto(`${BASE}/emergency/${INVALID_EMERGENCY_TOKEN}`, {
    waitUntil: 'domcontentloaded', timeout: 30000,
  });
  if (!response || response.status() !== 200) throw new Error(`Emergency SPA route returned ${response?.status()}`);
  await expectVisibleText('Record Not Found');
  await expectVisibleText('This QR code may be invalid or may have been regenerated.');
});

await check('Emergency API rejects an invalid token without data', async () => {
  const response = await context.request.get(`${BASE}/api/emergency-record?token=${INVALID_EMERGENCY_TOKEN}`);
  if (response.status() !== 404) throw new Error(`Expected 404, got ${response.status()}`);
  const text = await response.text();
  if (/vaccination|medication|allerg|emergency_phone|dog_id|user_id/i.test(text)) {
    throw new Error('Invalid-token response appears to contain record fields');
  }
});

await check('Private Storage gateway rejects anonymous access', async () => {
  const response = await context.request.get(`${BASE}/api/storage-file?path=live-smoke/no-file.pdf`);
  if (response.status() !== 401) throw new Error(`Expected 401, got ${response.status()}`);
});

await check('Health-certificate article has the correct body', async () => {
  const response = await page.goto(`${BASE}/blog/pet-health-certificates-explained.html`, {
    waitUntil: 'domcontentloaded', timeout: 30000,
  });
  if (!response || response.status() !== 200) throw new Error(`Article returned ${response?.status()}`);
  await page.getByRole('heading', { name: 'Pet Health Certificates Explained' }).waitFor({ state: 'visible' });
  await expectVisibleText('there is no single health certificate that works everywhere');
  const body = await page.locator('body').innerText();
  if (body.includes('Moving Across the Country With Pets: A Step-by-Step Checklist')) {
    throw new Error('Old duplicated article content is still present');
  }
});

await check('PWA manifest uses current brand colors', async () => {
  const response = await context.request.get(`${BASE}/manifest.json`);
  if (response.status() !== 200) throw new Error(`Manifest returned ${response.status()}`);
  const manifest = await response.json();
  if (manifest.theme_color !== '#2C4A38') throw new Error(`Unexpected theme_color ${manifest.theme_color}`);
  if (manifest.background_color !== '#FAFCFB') throw new Error(`Unexpected background_color ${manifest.background_color}`);
});

if (E2E_EMAIL && E2E_PASSWORD) {
  await check('Configured production test account can sign in', async () => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.getByRole('button', { name: 'Login' }).click();
    await page.getByLabel('Email address').fill(E2E_EMAIL);
    await page.getByLabel('Password').fill(E2E_PASSWORD);
    await page.getByRole('button', { name: 'Sign In', exact: true }).last().click();
    await page.waitForFunction(() => !document.body.innerText.includes("Your pet's records belong with you."), null, { timeout: 15000 });
    const body = await page.locator('body').innerText();
    if (/invalid login credentials|email not confirmed/i.test(body)) {
      throw new Error('Configured E2E account could not sign in');
    }
  });
} else {
  console.log('SKIP: Authenticated customer-flow test (E2E_EMAIL/E2E_PASSWORD secrets not configured).');
}

await browser.close();

if (failures.length) {
  console.error('\nLive smoke test failures:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('\nAll configured YourPetPass live smoke tests passed.');
