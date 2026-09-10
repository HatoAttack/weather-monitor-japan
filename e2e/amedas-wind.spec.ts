import { test, expect } from '@playwright/test';
import { baseTile } from './fixtures/tiles';

// One station at the configured map centre, reporting 北の風 15m/s.
// The arrow must therefore reach south of the station and nowhere else.
const table = { '99999': { lat: [36, 0], lon: [137, 0], alt: 10, kjName: '検証地点' } };
const data = { '99999': { temp: [20, 0], precipitation1h: [0, 0], windDirection: [16, 0], wind: [15, 0] } };

test('wind arrows point the way the air travels and only show for the wind metric', async ({ page }) => {
  await page.route('**/targetTimes_N1.json', route => route.fulfill({ json: [] }));
  await page.route('**/amedas/data/latest_time.txt', route => route.fulfill({ body: '2026-09-10T13:00:00+09:00' }));
  await page.route('**/amedas/const/amedastable.json', route => route.fulfill({ json: table }));
  await page.route('**/amedas/data/map/*.json', route => route.fulfill({ json: data }));
  await page.route('**/*.pbf', route => route.fulfill({ contentType: 'application/x-protobuf', body: '' }));
  await page.route('**/*.png', route => route.fulfill({ contentType: 'image/png', body: baseTile }));
  await page.goto('/');
  await page.locator('#section-amedas > summary').click();
  await expect(page.getByRole('button', { name: '風', exact: true })).toBeVisible();

  const canvas = page.locator('canvas');
  const bounds = (await canvas.boundingBox())!;
  const centre = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  const downwind = { x: centre.x - 18, y: centre.y + 9, width: 36, height: 26 };
  const upwind = { x: centre.x - 18, y: centre.y - 35, width: 36, height: 26 };

  const before = { downwind: await page.screenshot({ clip: downwind }), upwind: await page.screenshot({ clip: upwind }) };
  await page.getByRole('button', { name: '風', exact: true }).click();
  await expect(async () => {
    expect((await page.screenshot({ clip: downwind })).equals(before.downwind)).toBe(false);
  }).toPass({ timeout: 15_000 });
  expect((await page.screenshot({ clip: upwind })).equals(before.upwind)).toBe(true);

  // Hiding the observations, or picking another metric, takes the arrow away again.
  await page.getByRole('checkbox', { name: '観測値を地図に表示' }).uncheck();
  await expect(async () => {
    expect((await page.screenshot({ clip: downwind })).equals(before.downwind)).toBe(true);
  }).toPass({ timeout: 15_000 });
  await page.getByRole('checkbox', { name: '観測値を地図に表示' }).check();
  await expect(async () => {
    expect((await page.screenshot({ clip: downwind })).equals(before.downwind)).toBe(false);
  }).toPass({ timeout: 15_000 });
  await page.getByRole('button', { name: '気温', exact: true }).click();
  await expect(async () => {
    expect((await page.screenshot({ clip: downwind })).equals(before.downwind)).toBe(true);
  }).toPass({ timeout: 15_000 });
});
