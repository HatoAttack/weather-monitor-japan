import { test, expect } from '@playwright/test';
import { baseTile } from './fixtures/tiles';

test('built app loads its worker and renders selectable AMeDAS circles', async ({ page }) => {
  const workerFailures: string[] = [];
  page.on('requestfailed', request => {
    if (request.url().includes('maplibre-gl-worker')) workerFailures.push(request.url());
  });
  await page.route('**/targetTimes_N1.json', route => route.fulfill({ json: [] }));
  // The nowcast is fetched alongside; these tests cover observations only.
  await page.route('**/targetTimes_N2.json', route => route.fulfill({ json: [] }));
  await page.route('**/amedas/data/latest_time.txt', route => route.fulfill({ body: '2026-09-10T01:00:00+09:00' }));
  await page.route('**/amedas/const/amedastable.json', route => route.fulfill({ json: {
    '99999': { lat: [36, 0], lon: [137, 0], alt: 10, kjName: '検証地点' },
  } }));
  await page.route('**/amedas/data/map/*.json', route => route.fulfill({ json: {
    '99999': { temp: [25, 0], precipitation1h: [5, 0], windDirection: [4, 0], wind: [3, 0] },
  } }));
  await page.route('**/*.pbf', route => route.fulfill({ contentType: 'application/x-protobuf', body: '' }));
  await page.route('**/*.png', route => route.fulfill({ contentType: 'image/png', body: baseTile }));
  const workerResponse = page.waitForResponse(response => response.url().includes('maplibre-gl-worker'));
  await page.goto('/');
  expect((await workerResponse).status()).toBe(200);
  // Collapsed sections keep the panel short; open the one under test.
  await page.locator('#section-amedas > summary').click();
  const canvas = page.locator('canvas');
  const bounds = (await canvas.boundingBox())!;
  // The fixture is at the configured initial map center, outside the control panel.
  await expect(async () => {
    await canvas.click({ position: { x: bounds.width / 2, y: bounds.height / 2 } });
    await expect(page.locator('.station-card')).toContainText('検証地点');
  }).toPass({ timeout: 10_000 });
  await expect(page.locator('.station-card')).toContainText('25.0℃');
  const clip = { x: bounds.x + bounds.width / 2 - 20, y: bounds.y + bounds.height / 2 - 20, width: 40, height: 40 };
  const withCircle = await page.screenshot({ clip });
  const toggle = page.getByRole('checkbox', { name: '観測値を地図に表示' });
  await toggle.uncheck();
  await expect(async () => {
    expect((await page.screenshot({ clip })).equals(withCircle)).toBe(false);
  }).toPass();
  await toggle.check();
  await expect(async () => {
    expect((await page.screenshot({ clip })).equals(withCircle)).toBe(true);
  }).toPass();
  expect(workerFailures).toEqual([]);
});
