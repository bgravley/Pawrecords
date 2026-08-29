import { chromium } from 'playwright';

const BASE = (process.env.E2E_BASE_URL || 'https://yourpetpass.com').replace(/\/$/, '');
const OIDC_TOKEN = process.env.E2E_GITHUB_OIDC_TOKEN || '';
const INVALID_EMERGENCY_TOKEN = 'livesmokeinvalidtoken9f8e7d6c';
const RUN_TAG = String(process.env.GITHUB_RUN_ID || Date.now()).slice(-8);
const PET_NAME = `E2E Maple ${RUN_TAG}`;
const TRIP_NAME = `E2E Quito to Miami ${RUN_TAG}`;
const DOC_NAME = `E2E Private Record ${RUN_TAG}`;
const UPDATED_BREED = 'E2E Golden Mix Updated';
const VET_NAME = 'Dr. E2E Updated';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const failures = [];
const browser = await chromium.launch({ headless: true });

async function check(name, fn) {
  try {
    await fn();
    console.log(`PASS: ${name}`);
  } catch (error) {
    failures.push(`${name}: ${error.message}`);
    console.error(`FAIL: ${name} — ${error.message}`);
  }
}

async function step(name, fn) {
  try {
    const value = await fn();
    console.log(`  ✓ ${name}`);
    return value;
  } catch (error) {
    throw new Error(`${name}: ${error.message}`);
  }
}

function attachPageErrorCollector(page, label) {
  page.on('pageerror', error => {
    failures.push(`${label} browser page error: ${error.message}`);
  });
}

async function expectVisibleText(page, text, timeout = 15000) {
  await page.getByText(text, { exact: false }).first().waitFor({ state: 'visible', timeout });
}

function captureSupabase(page) {
  const info = { origin: '', anonKey: '' };
  page.on('request', request => {
    try {
      const url = new URL(request.url());
      if (!url.hostname.endsWith('.supabase.co')) return;
      if (!info.origin) info.origin = url.origin;
      const headers = request.headers();
      if (!info.anonKey && headers.apikey) info.anonKey = headers.apikey;
    } catch {
      // Ignore malformed/non-HTTP request URLs.
    }
  });
  return info;
}

async function readBrowserSession(page) {
  const session = await page.evaluate(() => {
    for (const [key, value] of Object.entries(localStorage)) {
      if (!key.startsWith('sb-') || !key.endsWith('-auth-token')) continue;
      try {
        const parsed = JSON.parse(value);
        if (parsed?.access_token && parsed?.user?.id) {
          return { accessToken: parsed.access_token, userId: parsed.user.id };
        }
        if (parsed?.currentSession?.access_token && parsed?.currentSession?.user?.id) {
          return { accessToken: parsed.currentSession.access_token, userId: parsed.currentSession.user.id };
        }
      } catch {
        // Ignore unrelated localStorage entries.
      }
    }
    return null;
  });
  if (!session?.accessToken || !session?.userId) throw new Error('Authenticated Supabase browser session was not found');
  return session;
}

async function waitForFileSessionCookie(context) {
  for (let i = 0; i < 30; i += 1) {
    const cookies = await context.cookies(BASE);
    if (cookies.some(cookie => cookie.name === 'ypp_file_session')) return;
    await sleep(250);
  }
  throw new Error('Private-file session cookie was not synchronized');
}

async function bootstrap(role, reset = false, deploymentWait = false) {
  if (!OIDC_TOKEN) throw new Error('E2E_GITHUB_OIDC_TOKEN is required; authenticated smoke tests may not be skipped');
  const attempts = deploymentWait ? 36 : 3;
  let lastStatus = 0;
  let lastMessage = '';

  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await fetch(`${BASE}/api/e2e-login`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OIDC_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role, reset }),
      });
      lastStatus = response.status;
      const type = response.headers.get('content-type') || '';
      const body = type.includes('application/json') ? await response.json() : null;

      if (response.ok && body?.actionLink && body?.userId) return body;
      lastMessage = body?.error || `HTTP ${response.status}`;

      // A push to main starts Vercel and this workflow at nearly the same time.
      // Retry only statuses consistent with the new production route not being
      // live yet or a short deployment transition. Authorization failures are
      // never retried because they indicate a real OIDC policy mismatch.
      if (deploymentWait && [404, 502, 503, 504].includes(response.status)) {
        await sleep(10000);
        continue;
      }
      throw new Error(`E2E bootstrap rejected (${response.status}): ${lastMessage}`);
    } catch (error) {
      if (deploymentWait && i < attempts - 1 && /fetch failed|ECONN|timed out/i.test(error.message)) {
        await sleep(10000);
        continue;
      }
      throw error;
    }
  }
  throw new Error(`E2E bootstrap did not become ready (last status ${lastStatus}: ${lastMessage})`);
}

async function loginWithActionLink(page, actionLink) {
  await page.goto(actionLink, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => {
    const text = document.body?.innerText || '';
    return text.includes('Welcome to YourPetPass') || text.includes('My Pets');
  }, null, { timeout: 30000 });
  const body = await page.locator('body').innerText();
  if (/invalid login credentials|token has expired|email not confirmed/i.test(body)) {
    throw new Error('One-time E2E login did not establish a valid session');
  }
}

async function modalFor(page, title) {
  const heading = page.getByRole('heading', { name: title, exact: true }).last();
  await heading.waitFor({ state: 'visible', timeout: 15000 });
  return heading.locator('xpath=../..');
}

async function fieldControl(root, labelText, selector = 'input') {
  const label = root.locator('label').filter({ hasText: labelText }).first();
  await label.waitFor({ state: 'visible', timeout: 10000 });
  const control = label.locator('..').locator(selector).first();
  await control.waitFor({ state: 'attached', timeout: 10000 });
  return control;
}

function authHeaders(info, session, extra = {}) {
  if (!info.origin || !info.anonKey) throw new Error('Supabase origin/API key were not observed from the production app');
  return {
    apikey: info.anonKey,
    Authorization: `Bearer ${session.accessToken}`,
    ...extra,
  };
}

async function restGet(context, info, session, table, params) {
  const query = new URLSearchParams(params).toString();
  const response = await context.request.get(`${info.origin}/rest/v1/${table}?${query}`, {
    headers: authHeaders(info, session),
  });
  if (response.status() !== 200) throw new Error(`${table} query returned ${response.status()}: ${(await response.text()).slice(0, 200)}`);
  return response.json();
}

async function createPrivateDocument(context, info, session, dogId) {
  const marker = `YOURPETPASS-E2E-${RUN_TAG}`;
  const path = `${session.userId}/e2e/${RUN_TAG}-private-record.pdf`;
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  const pdf = Buffer.from(
    `%PDF-1.4\n1 0 obj<< /Type /Catalog >>endobj\n2 0 obj<< /Length 45 >>stream\n${marker}\nendstream\nendobj\n%%EOF\n`,
    'utf8',
  );

  const upload = await context.request.post(`${info.origin}/storage/v1/object/documents/${encodedPath}`, {
    headers: authHeaders(info, session, {
      'Content-Type': 'application/pdf',
      'x-upsert': 'true',
    }),
    data: pdf,
  });
  if (![200, 201].includes(upload.status())) {
    throw new Error(`Private document upload returned ${upload.status()}: ${(await upload.text()).slice(0, 200)}`);
  }

  const insert = await context.request.post(`${info.origin}/rest/v1/documents`, {
    headers: authHeaders(info, session, {
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    }),
    data: {
      dog_id: dogId,
      user_id: session.userId,
      name: DOC_NAME,
      doc_date: '2026-08-29',
      doc_type: 'E2E Private Record',
      notes: 'Synthetic production smoke-test document',
      file_path: path,
    },
  });
  if (![200, 201].includes(insert.status())) {
    throw new Error(`Document metadata insert returned ${insert.status()}: ${(await insert.text()).slice(0, 200)}`);
  }
  const rows = await insert.json();
  const row = Array.isArray(rows) ? rows[0] : rows;
  if (!row?.id) throw new Error('Document insert did not return an ID');
  return { id: row.id, path, marker };
}

// ────────────────────────────────────────────────────────────
// Public/anonymous smoke checks
// ────────────────────────────────────────────────────────────
const publicContext = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  userAgent: 'YourPetPass-Live-Smoke/2.0',
});
const publicPage = await publicContext.newPage();
attachPageErrorCollector(publicPage, 'Public smoke');

await check('Homepage renders the interactive marketing experience', async () => {
  const response = await publicPage.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
  if (!response || response.status() !== 200) throw new Error(`Homepage returned ${response?.status()}`);
  await publicPage.getByRole('button', { name: 'Login' }).waitFor({ state: 'visible', timeout: 15000 });
  const title = await publicPage.title();
  if (!title.includes('YourPetPass')) throw new Error(`Unexpected title: ${title}`);
  await expectVisibleText(publicPage, 'One place for every vet visit, vaccine, and trip your pet takes.');
});

await check('Authentication UI renders and uses the secured emergency-access explanation', async () => {
  await publicPage.getByRole('button', { name: 'Login' }).click();
  await expectVisibleText(publicPage, "Your pet's records belong with you.");
  await publicPage.getByRole('button', { name: 'Create Account' }).click();
  await publicPage.getByPlaceholder(/Password \(min \d+ characters\)/).waitFor({ state: 'visible' });
  await publicPage.getByRole('button', { name: 'Have an emergency QR code?' }).click();
  await expectVisibleText(publicPage, 'There is no public directory of pets or medical records.');
  const body = await publicPage.locator('body').innerText();
  if (body.includes('Select the pet to view their health record.')) throw new Error('Legacy public-pet lookup copy is still present');
});

await check('Invalid Emergency QR token reveals no record', async () => {
  const response = await publicPage.goto(`${BASE}/emergency/${INVALID_EMERGENCY_TOKEN}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  if (!response || response.status() !== 200) throw new Error(`Emergency SPA route returned ${response?.status()}`);
  await expectVisibleText(publicPage, 'Record Not Found');
  await expectVisibleText(publicPage, 'This QR code may be invalid or may have been regenerated.');
});

await check('Emergency API rejects an invalid token without data', async () => {
  const response = await publicContext.request.get(`${BASE}/api/emergency-record?token=${INVALID_EMERGENCY_TOKEN}`);
  if (response.status() !== 404) throw new Error(`Expected 404, got ${response.status()}`);
  const text = await response.text();
  if (/vaccination|medication|allerg|emergency_phone|dog_id|user_id/i.test(text)) throw new Error('Invalid-token response appears to contain record fields');
});

await check('Private Storage gateway rejects anonymous access', async () => {
  const response = await publicContext.request.get(`${BASE}/api/storage-file?path=live-smoke/no-file.pdf`);
  if (response.status() !== 401) throw new Error(`Expected 401, got ${response.status()}`);
});

await check('Health-certificate article has the correct body', async () => {
  const response = await publicPage.goto(`${BASE}/blog/pet-health-certificates-explained.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  if (!response || response.status() !== 200) throw new Error(`Article returned ${response?.status()}`);
  await publicPage.getByRole('heading', { name: 'Pet Health Certificates Explained' }).waitFor({ state: 'visible' });
  await expectVisibleText(publicPage, 'there is no single health certificate that works everywhere');
  const body = await publicPage.locator('body').innerText();
  if (body.includes('Moving Across the Country With Pets: A Step-by-Step Checklist')) throw new Error('Old duplicated article content is still present');
});

await check('PWA manifest uses current brand colors', async () => {
  const response = await publicContext.request.get(`${BASE}/manifest.json`);
  if (response.status() !== 200) throw new Error(`Manifest returned ${response.status()}`);
  const manifest = await response.json();
  if (manifest.theme_color !== '#2C4A38') throw new Error(`Unexpected theme_color ${manifest.theme_color}`);
  if (manifest.background_color !== '#FAFCFB') throw new Error(`Unexpected background_color ${manifest.background_color}`);
});

await publicContext.close();

// ────────────────────────────────────────────────────────────
// Full authenticated production customer journey
// ────────────────────────────────────────────────────────────
let primaryDogId = '';
let primaryTripId = '';
let primaryDocument = null;
let primarySupabase = null;
let primarySession = null;

await check('Authenticated production customer flow works end to end', async () => {
  const primary = await step('OIDC-gated synthetic primary account is ready', () => bootstrap('primary', true, true));
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent: 'YourPetPass-Authenticated-E2E/2.0',
  });
  const page = await context.newPage();
  attachPageErrorCollector(page, 'Authenticated primary');
  primarySupabase = captureSupabase(page);

  try {
    await step('One-time magic link signs into production', async () => {
      await loginWithActionLink(page, primary.actionLink);
      primarySession = await readBrowserSession(page);
      if (primarySession.userId !== primary.userId) throw new Error('Browser session belongs to an unexpected user');
      await waitForFileSessionCookie(context);
    });

    await step('Pet can be created through the production UI', async () => {
      const add = page.getByRole('button', { name: /Add Your First Pet|Add Pet/ }).first();
      await add.click();
      const modal = await modalFor(page, 'Add Pet');
      await (await fieldControl(modal, 'Name')).fill(PET_NAME);
      await (await fieldControl(modal, 'Breed')).fill('E2E Golden Mix');
      await (await fieldControl(modal, 'Date of Birth')).fill('2021-06-15');
      await (await fieldControl(modal, 'Weight (lbs)')).fill('39.5');
      await (await fieldControl(modal, 'Color')).fill('Light tan');
      await (await fieldControl(modal, 'Microchip ID')).fill(`98500000${RUN_TAG}`);
      await (await fieldControl(modal, 'Emergency Contact')).fill('E2E Emergency Contact');
      await (await fieldControl(modal, 'Emergency Phone Number')).fill('5550109');
      await modal.getByRole('button', { name: 'Save Pet', exact: true }).click();
      await page.getByText(PET_NAME, { exact: true }).first().waitFor({ state: 'visible', timeout: 15000 });

      primarySession = await readBrowserSession(page);
      for (let i = 0; i < 20 && (!primarySupabase.origin || !primarySupabase.anonKey); i += 1) await sleep(250);
      const dogs = await restGet(context, primarySupabase, primarySession, 'dogs', {
        name: `eq.${PET_NAME}`,
        select: 'id,name,breed,user_id',
      });
      if (dogs.length !== 1 || dogs[0].user_id !== primarySession.userId) throw new Error('Created pet was not returned under the signed-in owner');
      primaryDogId = dogs[0].id;
    });

    await step('Pet profile can be edited and persists', async () => {
      await page.getByText(PET_NAME, { exact: true }).first().click();
      await page.getByRole('button', { name: 'Edit', exact: true }).click();
      const modal = await modalFor(page, 'Edit Profile');
      await (await fieldControl(modal, 'Breed')).fill(UPDATED_BREED);
      await modal.getByRole('button', { name: 'Save Pet', exact: true }).click();
      await page.getByText(UPDATED_BREED, { exact: true }).first().waitFor({ state: 'visible', timeout: 15000 });
    });

    await step('Vaccination can be created and then updated', async () => {
      await page.getByRole('button', { name: 'Vaccines', exact: true }).click();
      await page.getByRole('button', { name: 'Record Vaccination', exact: true }).click();
      let modal = await modalFor(page, 'Record Vaccination');
      await (await fieldControl(modal, 'Select Vaccine', 'select')).selectOption('Rabies');
      await (await fieldControl(modal, 'Date Given')).fill('2026-08-01');
      await (await fieldControl(modal, 'Lot #')).fill(`LOT-${RUN_TAG}`);
      await (await fieldControl(modal, 'Vet')).fill('Dr. E2E Initial');
      await modal.getByRole('button', { name: 'Save', exact: true }).click();
      const rabies = page.getByText('Rabies', { exact: true }).first();
      await rabies.waitFor({ state: 'visible', timeout: 15000 });

      const card = rabies.locator('xpath=../..');
      const buttons = card.locator('button');
      const count = await buttons.count();
      if (count < 2) throw new Error('Vaccination edit control was not found');
      await buttons.nth(count === 3 ? 1 : 0).click();
      modal = await modalFor(page, 'Edit Vaccination');
      await (await fieldControl(modal, 'Vet')).fill(VET_NAME);
      await modal.getByRole('button', { name: 'Save', exact: true }).click();
      await page.getByText(VET_NAME, { exact: true }).waitFor({ state: 'visible', timeout: 15000 });
    });

    await step('Private document upload, metadata, UI listing, and authenticated retrieval work', async () => {
      primaryDocument = await createPrivateDocument(context, primarySupabase, primarySession, primaryDogId);

      // Reload the app so its normal initial data load sees the new document.
      await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.getByText(PET_NAME, { exact: true }).first().waitFor({ state: 'visible', timeout: 15000 });
      await page.getByText(PET_NAME, { exact: true }).first().click();
      await page.getByRole('button', { name: 'More', exact: true }).click();
      await page.getByText('Documents', { exact: true }).first().click();
      await page.getByText(DOC_NAME, { exact: true }).waitFor({ state: 'visible', timeout: 15000 });

      const docCard = page.getByText(DOC_NAME, { exact: true }).locator('xpath=ancestor::div[.//a][1]');
      const href = await docCard.locator('a').first().getAttribute('href');
      if (!href || !href.includes('/api/storage-file?path=')) throw new Error(`Document UI did not use the private same-origin gateway: ${href}`);

      await waitForFileSessionCookie(context);
      const fileResponse = await context.request.get(new URL(href, BASE).toString());
      if (fileResponse.status() !== 200) throw new Error(`Private document retrieval returned ${fileResponse.status()}`);
      const bytes = await fileResponse.body();
      if (!bytes.toString('utf8').includes(primaryDocument.marker)) throw new Error('Retrieved private document did not match the uploaded file');
    });

    let emergencyUrl = '';
    await step('Emergency QR generates and exposes only the intended emergency record', async () => {
      // MoreTab keeps its own nested section state. Return to My Pets and
      // reopen the pet before entering More again so the QR tile is the
      // actual customer navigation path rather than relying on stale state.
      await page.getByTitle('Home').click();
      await page.getByText(PET_NAME, { exact: true }).first().waitFor({ state: 'visible', timeout: 15000 });
      await page.getByText(PET_NAME, { exact: true }).first().click();
      await page.getByRole('button', { name: 'More', exact: true }).click();
      await page.getByText('QR Health Card', { exact: true }).first().click();
      await page.getByRole('heading', { name: 'Emergency QR', exact: true }).waitFor({ state: 'visible', timeout: 15000 });

      const urlText = page.locator('span').filter({ hasText: '/emergency/' }).first();
      await urlText.waitFor({ state: 'visible', timeout: 15000 });
      emergencyUrl = (await urlText.innerText()).trim();
      let parsedEmergencyUrl = null;
      try { parsedEmergencyUrl = new URL(emergencyUrl); } catch {}
      if (!parsedEmergencyUrl ||
          !['yourpetpass.com', 'www.yourpetpass.com'].includes(parsedEmergencyUrl.hostname) ||
          !/^\/emergency\/[a-f0-9]{32}$/i.test(parsedEmergencyUrl.pathname)) {
        throw new Error(`Unexpected emergency URL: ${emergencyUrl}`);
      }

      const token = emergencyUrl.split('/').pop();
      const apiResponse = await context.request.get(`${BASE}/api/emergency-record?token=${encodeURIComponent(token)}`);
      if (apiResponse.status() !== 200) throw new Error(`Emergency API returned ${apiResponse.status()}`);
      const record = await apiResponse.json();
      if (record?.pet?.name !== PET_NAME) throw new Error('Emergency API returned the wrong pet');
      if (!Array.isArray(record.vaccinations) || !record.vaccinations.some(v => v.name === 'Rabies')) throw new Error('Emergency record did not include the recorded Rabies vaccination');
      const serialized = JSON.stringify(record);
      if (/file_path|documents|user_id|subscription_tier|stripe/i.test(serialized) || serialized.includes(DOC_NAME)) {
        throw new Error('Emergency API exposed private account/document fields');
      }

      const emergencyPage = await context.newPage();
      attachPageErrorCollector(emergencyPage, 'Emergency record');
      await emergencyPage.goto(emergencyUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await emergencyPage.getByText(PET_NAME, { exact: true }).first().waitFor({ state: 'visible', timeout: 15000 });
      const publicBody = await emergencyPage.locator('body').innerText();
      if (publicBody.includes(DOC_NAME)) throw new Error('Private document name appeared on the public Emergency QR page');
      await emergencyPage.close();
    });

    await step('Travel planner can create a real trip tied to the pet', async () => {
      await page.getByTitle('Home').click();
      await page.getByRole('button', { name: 'TRAVEL', exact: true }).click();
      await page.getByText('Travel Planner', { exact: false }).first().waitFor({ state: 'visible', timeout: 15000 });
      await page.getByRole('button', { name: '+ New Trip', exact: true }).click();
      const modal = await modalFor(page, 'Plan New Trip');
      await (await fieldControl(modal, 'Trip Name (optional)')).fill(TRIP_NAME);
      await (await fieldControl(modal, 'From City')).fill('Quito');
      await (await fieldControl(modal, 'From Country', 'select')).selectOption('Ecuador');
      await (await fieldControl(modal, 'To City')).fill('Miami');
      await (await fieldControl(modal, 'To Country', 'select')).selectOption('United States');
      await (await fieldControl(modal, 'Departure Date')).fill('2026-10-15');
      const petChoice = modal.locator('label').filter({ hasText: PET_NAME }).locator('input[type="checkbox"]').first();
      await petChoice.check();
      await modal.getByRole('button', { name: 'Create Trip', exact: true }).click();
      await page.getByText('Quito → Miami', { exact: true }).first().waitFor({ state: 'visible', timeout: 15000 });

      const trips = await restGet(context, primarySupabase, primarySession, 'trips', {
        name: `eq.${TRIP_NAME}`,
        select: 'id,name,user_id,pet_ids,origin_city,destination_city',
      });
      if (trips.length !== 1 || trips[0].user_id !== primarySession.userId) throw new Error('Created trip was not owned by the signed-in user');
      if (!Array.isArray(trips[0].pet_ids) || !trips[0].pet_ids.includes(primaryDogId)) throw new Error('Created trip did not include the test pet');
      primaryTripId = trips[0].id;
    });

    await step('Sign out works and a second one-time login preserves records', async () => {
      await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.getByText(PET_NAME, { exact: true }).first().waitFor({ state: 'visible', timeout: 15000 });
      await page.locator('button[title="Sign out"]').click();
      await page.getByRole('button', { name: 'Login' }).waitFor({ state: 'visible', timeout: 15000 });

      const secondLogin = await bootstrap('primary', false, false);
      await loginWithActionLink(page, secondLogin.actionLink);
      await page.getByText(PET_NAME, { exact: true }).first().waitFor({ state: 'visible', timeout: 15000 });
      await page.getByRole('button', { name: 'TRAVEL', exact: true }).click();
      await page.getByText(TRIP_NAME, { exact: true }).first().waitFor({ state: 'visible', timeout: 15000 });
      await page.getByText('← My Pets', { exact: true }).click();
      const sessionAgain = await readBrowserSession(page);
      if (sessionAgain.userId !== primarySession.userId) throw new Error('Re-login changed the test account identity');
    });
  } finally {
    await context.close();
  }
});

await check('RLS and private Storage isolate one signed-in customer from another', async () => {
  if (!primaryDogId || !primaryTripId || !primaryDocument || !primarySupabase?.origin || !primarySupabase?.anonKey) {
    throw new Error('Primary flow did not produce the records required for the isolation test');
  }

  const secondary = await bootstrap('secondary', true, false);
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent: 'YourPetPass-Isolation-E2E/2.0',
  });
  const page = await context.newPage();
  attachPageErrorCollector(page, 'Authenticated secondary');
  const secondarySupabase = captureSupabase(page);

  try {
    await step('Second synthetic customer signs in independently', async () => {
      await loginWithActionLink(page, secondary.actionLink);
      await expectVisibleText(page, 'Welcome to YourPetPass');
      const body = await page.locator('body').innerText();
      if (body.includes(PET_NAME) || body.includes(TRIP_NAME) || body.includes(DOC_NAME)) throw new Error('Primary customer data appeared in the secondary customer UI');
    });

    await step('RLS blocks reads of the first customer pet, trip, and document rows', async () => {
      const session = await readBrowserSession(page);
      for (let i = 0; i < 20 && (!secondarySupabase.origin || !secondarySupabase.anonKey); i += 1) await sleep(250);
      const info = secondarySupabase.origin ? secondarySupabase : primarySupabase;

      for (const [table, id] of [['dogs', primaryDogId], ['trips', primaryTripId], ['documents', primaryDocument.id]]) {
        const rows = await restGet(context, info, session, table, { id: `eq.${id}`, select: 'id' });
        if (rows.length !== 0) throw new Error(`Secondary customer could read primary ${table} row`);
      }

      const update = await context.request.patch(`${info.origin}/rest/v1/dogs?id=eq.${encodeURIComponent(primaryDogId)}&select=id,name`, {
        headers: authHeaders(info, session, {
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        }),
        data: { name: 'RLS SHOULD BLOCK THIS' },
      });
      if (update.status() !== 200) throw new Error(`Cross-customer update probe returned unexpected ${update.status()}`);
      const rows = await update.json();
      if (Array.isArray(rows) && rows.length !== 0) throw new Error('Secondary customer was able to update the primary pet');
    });

    await step('Private file gateway rejects the second customer for the first customer file', async () => {
      await waitForFileSessionCookie(context);
      const response = await context.request.get(`${BASE}/api/storage-file?path=${encodeURIComponent(primaryDocument.path)}`);
      if (response.status() !== 403) throw new Error(`Expected 403 for cross-customer private file, got ${response.status()}`);
    });
  } finally {
    await context.close();
  }
});

await check('Synthetic E2E records are cleaned after the run', async () => {
  await bootstrap('primary', true, false);
  await bootstrap('secondary', true, false);
});

await browser.close();

if (failures.length) {
  console.error('\nLive smoke test failures:');
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('\nAll YourPetPass public and authenticated production smoke tests passed.');
