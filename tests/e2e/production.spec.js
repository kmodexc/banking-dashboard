import { expect, test } from '@playwright/test';

const csv = [
  'Buchungstag;Wertstellung;Buchungstext;Kontonummer;Empfänger;Zweck;Art;Saldo;Umsatz;A;B;C',
  '02.01.2026;02.01.2026;Kartenzahlung;;UNKNOWN SHOP;Sonstiges;Ausgang;;-8,00;;;',
].join('\n');

async function signIn(page) {
  const signInButton = page.getByRole('button', { name: 'Sign in' });
  if (await signInButton.isVisible()) {
    await signInButton.click();
  }
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
}

test('persists an authenticated rule through the built bundle and real API', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  await signIn(page);

  await page.locator('#csv-input').setInputFiles({
    name: 'transactions.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv),
  });
  await page.getByRole('button', { name: 'Categorize unknown' }).click();
  await page.locator('#rule-keyword').fill('UNKNOWN SHOP');
  await page.locator('#rule-category').fill('items');
  await page.locator('#rule-form button[type=submit]').click();
  await expect(page.locator('#unknown-count')).toHaveText('0 rows');

  await page.getByRole('button', { name: 'Categories' }).click();
  const privateOption = page.getByRole('checkbox', {
    name: /Save my categories and rules privately/,
  });
  await expect(privateOption).toBeChecked();
  const privatePut = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/rules') &&
      response.request().method() === 'PUT' &&
      response.status() === 200,
  );
  await page.getByRole('button', { name: 'Sync privately now' }).click();
  await privatePut;

  await page.evaluate(() => localStorage.removeItem('dkb-dashboard-rules-v1'));
  await page.reload();
  await signIn(page);
  await page.getByRole('button', { name: 'Categories' }).click();
  await expect(page.getByRole('heading', { name: 'Categorization rules' })).toBeVisible();
  await expect(page.locator('[aria-label="Categorization rule list"]')).toContainText(
    'UNKNOWN SHOP',
  );
});
