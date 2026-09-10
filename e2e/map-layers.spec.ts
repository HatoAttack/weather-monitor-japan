import { test, expect } from '@playwright/test';
import { baseTile, rainTile } from './fixtures/tiles';

test('base map details can be switched off from the panel', async ({ page }) => {
  await page.route('**/targetTimes_N1.json', route => route.fulfill({ json: [] }));
  // The nowcast is fetched alongside; these tests cover observations only.
  await page.route('**/targetTimes_N2.json', route => route.fulfill({ json: [] }));
  await page.route('**/amedas/**', route => route.abort());
  await page.route('**/*.pbf', route => route.fulfill({ contentType: 'application/x-protobuf', body: '' }));
  await page.route('**/*.png', route => route.fulfill({ contentType: 'image/png', body: baseTile }));
  // A distinct image, so switching the elevation colouring off is visible.
  await page.route('**/xyz/relief/**', route => route.fulfill({ contentType: 'image/png', body: rainTile }));
  await page.goto('/');
  await page.locator('#section-map > summary').click();

  const canvas = page.locator('canvas');
  const bounds = (await canvas.boundingBox())!;
  const clip = { x: bounds.x + bounds.width / 2 - 150, y: bounds.y + bounds.height / 2 - 110, width: 300, height: 220 };
  // Elevation colouring only joins once the map is on a region.
  const zoomIn = page.getByRole('button', { name: 'Zoom in' });
  // Each click animates, so the next one has to wait or the zoom falls short.
  for (let step = 0; step < 4; step++) { await zoomIn.click(); await page.waitForTimeout(900); }

  const elevation = page.getByRole('checkbox', { name: '標高の色分け' });
  await expect(elevation).toBeChecked();
  await expect(async () => {
    const withColour = await page.screenshot({ clip });
    await elevation.uncheck();
    await page.waitForTimeout(700);
    const without = await page.screenshot({ clip });
    expect(without.equals(withColour)).toBe(false);
    await elevation.check();
    await page.waitForTimeout(2_500);
    expect((await page.screenshot({ clip })).equals(without)).toBe(false);
  }).toPass({ timeout: 25_000 });

  // The summary counts what is still switched on, so a collapsed section still says.
  await elevation.uncheck();
  await page.getByRole('checkbox', { name: '鉄道' }).uncheck();
  await expect(page.locator('#section-map > summary')).toContainText('2/4');
});
