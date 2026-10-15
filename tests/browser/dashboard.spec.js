import { expect, test } from '@playwright/test';

const csv = [
  'Buchungstag;Wertstellung;Buchungstext;Kontonummer;' +
    'Auftraggeber / Begünstigter;Verwendungszweck;Art;Saldo;Umsatz;Zusatz 1;Zusatz 2;Zusatz 3',
  '01.01.2026;01.01.2026;Kartenzahlung;;REWE Markt;Lebensmittel;Ausgang;;-12,50;;;',
  '02.01.2026;02.01.2026;Kartenzahlung;;UNKNOWN SHOP;Sonstiges;Ausgang;;-8,00;;;',
].join('\n');

async function configurePage(page, { authenticated = false, navigate = true } = {}) {
  await page.route('**/config.js', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `window.APP_CONFIG = ${JSON.stringify({
        keycloakIssuer: authenticated ? 'http://keycloak.test/realms/kmode' : '',
        keycloakClientId: authenticated ? 'dkb-dashboard' : '',
        apiBaseUrl: '',
      })};`,
    }),
  );
  if (navigate) await page.goto('/');
}

async function configureKeycloak(page) {
  await configurePage(page, { authenticated: true, navigate: false });
  await page.route('http://keycloak.test/realms/kmode/.well-known/openid-configuration', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        authorization_endpoint: 'http://keycloak.test/realms/kmode/auth',
        token_endpoint: 'http://keycloak.test/realms/kmode/token',
        end_session_endpoint: 'http://keycloak.test/realms/kmode/logout',
      }),
    }),
  );
  await page.route('http://keycloak.test/realms/kmode/auth**', (route) => {
    const requestUrl = new URL(route.request().url());
    const redirect = new URL(requestUrl.searchParams.get('redirect_uri'));
    redirect.searchParams.set('code', 'test-code');
    redirect.searchParams.set('state', requestUrl.searchParams.get('state'));
    return route.fulfill({ status: 302, headers: { location: redirect.toString() } });
  });
  await page.route('http://keycloak.test/realms/kmode/token', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: 'eyJhbGciOiJub25lIn0.eyJwcmVmZXJyZWRfdXNlcm5hbWUiOiJ0ZXN0In0.',
        refresh_token: 'refresh-token',
        expires_in: 300,
      }),
    }),
  );
}

test('imports a CSV and renders dashboard data in the browser', async ({ page }) => {
  await configurePage(page);
  await page.locator('#csv-input').setInputFiles({
    name: 'transactions.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv),
  });

  await expect(page.locator('#app-panel')).toBeVisible();
  await expect(page.locator('#data-status')).toHaveText('2 transactions loaded');
  await expect(page.locator('#transaction-table')).toContainText('REWE Markt');
  await page.locator('[data-tab="categories"]').click();
  await expect(page.locator('#categories-tab')).toContainText('Categories');
  await expect(page.locator('#categories-tab button', { hasText: 'Add category' })).toBeDisabled();
});

test('keeps the setup notice visible alongside a CSV import error', async ({ page }) => {
  await configurePage(page, { authenticated: true, navigate: false });
  await page.route('http://keycloak.test/realms/kmode/.well-known/openid-configuration', (route) =>
    route.fulfill({ status: 503, body: 'identity provider unavailable' }),
  );
  await page.goto('/');

  await expect(page.locator('#setup-panel')).toBeVisible();
  await page.locator('#csv-input').setInputFiles({
    name: 'broken.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      [
        'Buchungstag;Wertstellung;Buchungstext;Kontonummer;Empfänger;Zweck;Art;Saldo;Umsatz;A;B;C',
        '02.01.2026;02.01.2026;Kartenzahlung;;UNKNOWN SHOP;Sonstiges;Ausgang;;;',
      ].join('\n'),
    ),
  });

  await expect(page.locator('#setup-panel')).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('Line 2:');
});

test('shows a clear warning when automatic rule synchronization fails', async ({ page }) => {
  await configureKeycloak(page);
  await page.addInitScript(() => {
    localStorage.setItem(
      'dkb-dashboard-rule-preferences-v1:test',
      JSON.stringify({ storePrivateRules: true, useCommunityRules: false, contributeRules: false }),
    );
  });
  await page.route('**/api/rules**', async (route) => {
    if (route.request().method() === 'PUT') {
      return route.fulfill({ status: 503, body: 'rule sync unavailable' });
    }
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ private: [], community: [] }),
    });
  });

  await page.goto('/');
  await page.locator('#login-button').click();
  await expect(page.locator('#logout-button')).toBeVisible();
  await page.locator('#csv-input').setInputFiles({
    name: 'transactions.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv),
  });
  await page.locator('[data-tab="unknown"]').click();
  await page.locator('#rule-keyword').fill('UNKNOWN SHOP');
  await page.locator('#rule-category').fill('items');
  await page.locator('#rule-form button[type=submit]').click();
  await page.locator('[data-tab="categories"]').click();
  await page.getByRole('button', { name: 'Sync selected rules now' }).click();

  await expect(page.locator('#rule-sync-error')).toContainText('Rule synchronization warning:');
  await expect(page.locator('#rule-sync-error')).toContainText('Could not sync rules');
  await expect(page.locator('#rule-sync-error')).toHaveAttribute('aria-live', 'assertive');
});

test('stores a manual categorization rule locally without an API request', async ({ page }) => {
  await configurePage(page);
  let apiCalls = 0;
  await page.route('**/api/**', (route) => {
    apiCalls += 1;
    return route.abort();
  });
  await page.locator('#csv-input').setInputFiles({
    name: 'transactions.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv),
  });
  await page.locator('[data-tab="unknown"]').click();
  await page.locator('#rule-keyword').fill('UNKNOWN SHOP');
  await page.locator('#rule-category').fill('items');
  await page.locator('#rule-form button[type=submit]').click();

  await expect(page.locator('#unknown-count')).toHaveText('1 rows');
  expect(apiCalls).toBe(0);
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('dkb-dashboard-rules-v1')))
    .toContain('UNKNOWN SHOP');
});

test('sends only selected classification fields when AI classification is requested', async ({
  page,
}) => {
  await configureKeycloak(page);

  let requestBody;
  await page.route('**/api/classify', async (route) => {
    requestBody = JSON.parse(route.request().postData());
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        rules: [
          { keyword: 'UNKNOWN SHOP', category: 'items', column: 'recipient', confidence: 0.95 },
        ],
      }),
    });
  });

  await page.goto('/');
  await page.locator('#login-button').click();
  await expect(page.locator('#logout-button')).toBeVisible();
  await page.locator('#csv-input').setInputFiles({
    name: 'transactions.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv),
  });
  await page.locator('[data-tab="unknown"]').click();
  await page.locator('#classify-button').click();

  await expect(page.locator('#classify-status')).toHaveText('1 rules accepted.');
  expect(requestBody.transactions).toEqual([
    { id: '2026-01-02-2', recipient: 'UNKNOWN SHOP', purpose: 'Sonstiges' },
    { id: '2026-01-01-1', recipient: 'REWE Markt', purpose: 'Lebensmittel' },
  ]);
  for (const transaction of requestBody.transactions) {
    expect(transaction).not.toHaveProperty('amount');
  }
});
