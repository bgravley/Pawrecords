import { chromium } from 'playwright';

const BASE = (process.env.E2E_BASE_URL || 'https://www.yourpetpass.com').replace(/\/$/, '');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const ANALYTICS_URL = /googletagmanager\.com\/gtag\/js|www\.clarity\.ms\/tag\//i;
const VERCEL_ANALYTICS_URL = /\/_vercel\/insights\//i;

async function testCurrentDeployment(browser) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent: 'YourPetPass-Privacy-Consent-Smoke/1.0',
  });
  const page = await context.newPage();
  const analyticsRequests = [];
  page.on('request', request => {
    const url = request.url();
    if (ANALYTICS_URL.test(url) || VERCEL_ANALYTICS_URL.test(url)) analyticsRequests.push(url);
  });

  try {
    const response = await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
    if (!response || response.status() !== 200) return { ready: false, reason: `homepage ${response?.status()}` };

    const essential = page.getByRole('button', { name: 'Essential only', exact: true });
    try {
      await essential.waitFor({ state: 'visible', timeout: 4000 });
    } catch {
      return { ready: false, reason: 'privacy consent UI not deployed yet' };
    }

    await sleep(800);
    if (analyticsRequests.length) {
      throw new Error(`Optional analytics loaded before consent: ${analyticsRequests.join(', ')}`);
    }

    await page.getByRole('button', { name: 'Allow analytics', exact: true }).waitFor({ state: 'visible', timeout: 3000 });
    await essential.click();
    const stored = await page.evaluate(() => localStorage.getItem('ypp_analytics_consent_v1'));
    if (stored !== 'denied') throw new Error(`Essential-only preference was not stored (got ${stored})`);

    await sleep(800);
    if (analyticsRequests.length) throw new Error(`Analytics loaded after Essential only: ${analyticsRequests.join(', ')}`);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Open privacy choices', exact: true }).waitFor({ state: 'visible', timeout: 5000 });
    await sleep(500);
    if (analyticsRequests.length) throw new Error(`Denied preference did not persist across reload: ${analyticsRequests.join(', ')}`);

    await page.getByRole('button', { name: 'Open privacy choices', exact: true }).click();
    await page.getByRole('button', { name: 'Essential only', exact: true }).waitFor({ state: 'visible', timeout: 3000 });
    await page.getByRole('button', { name: 'Allow analytics', exact: true }).waitFor({ state: 'visible', timeout: 3000 });

    return { ready: true };
  } finally {
    await context.close();
  }
}

async function testGpc(browser) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent: 'YourPetPass-Privacy-Consent-Smoke/1.0',
  });
  await context.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'globalPrivacyControl', { configurable: true, get: () => true });
  });
  const page = await context.newPage();
  const analyticsRequests = [];
  page.on('request', request => {
    const url = request.url();
    if (ANALYTICS_URL.test(url) || VERCEL_ANALYTICS_URL.test(url)) analyticsRequests.push(url);
  });

  try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.getByText('Browser privacy signal detected.', { exact: false }).waitFor({ state: 'visible', timeout: 5000 });
    if (await page.getByRole('button', { name: 'Allow analytics', exact: true }).count()) {
      throw new Error('Allow analytics is offered while Global Privacy Control is active');
    }
    await sleep(800);
    if (analyticsRequests.length) throw new Error(`Analytics loaded while GPC was active: ${analyticsRequests.join(', ')}`);
  } finally {
    await context.close();
  }
}

const browser = await chromium.launch({ headless: true });
try {
  let lastReason = '';
  let ready = false;
  for (let attempt = 1; attempt <= 36; attempt += 1) {
    const result = await testCurrentDeployment(browser);
    if (result.ready) {
      ready = true;
      console.log('PASS: Optional analytics are blocked until consent and Essential only persists');
      break;
    }
    lastReason = result.reason || 'not ready';
    console.log(`WAIT: privacy consent deployment not ready (${attempt}/36): ${lastReason}`);
    if (attempt < 36) await sleep(10000);
  }
  if (!ready) throw new Error(`Privacy consent deployment did not become ready: ${lastReason}`);

  await testGpc(browser);
  console.log('PASS: Global Privacy Control keeps optional analytics disabled');
} finally {
  await browser.close();
}
