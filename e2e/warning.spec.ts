import { test, expect } from '@playwright/test';
import { baseTile } from './fixtures/tiles';
import { stubWarnings, warningReport } from './fixtures/warnings';

async function setup(page: import('@playwright/test').Page) {
  await page.route('**/targetTimes_N1.json', route => route.fulfill({ json: [] }));
  await page.route('**/targetTimes_N2.json', route => route.fulfill({ json: [] }));
  // No stations, so a click on the map centre lands on the warning area.
  await page.route('**/amedas/**', route => route.abort());
  await page.route('**/*.pbf', route => route.fulfill({ contentType: 'application/x-protobuf', body: '' }));
  await page.route('**/*.png', route => route.fulfill({ contentType: 'image/png', body: baseTile }));
}

test('warning areas are painted, counted and explained', async ({ page }) => {
  await setup(page);
  let reports = warningReport([{ code: '03', status: '発表' }, { code: '29', status: '継続' }, { code: '14', status: '解除' }]);
  let failing = false;
  await stubWarnings(page);
  await page.route('**/warning/data/r8/map.json', route => failing
    ? route.fulfill({ status: 503, body: 'unavailable' })
    : route.fulfill({ json: reports }));
  await page.goto('/');

  const section = page.locator('#section-warning');
  await expect(section.locator('summary')).toContainText('警報以上 1区域');
  await section.locator('summary').click();
  await expect(section.locator('.warning-legend')).toContainText(/警報\s*1\s*区域/);

  // The area card lists what is in force, most severe first; the lifted advisory is gone.
  const canvas = page.locator('canvas');
  const bounds = (await canvas.boundingBox())!;
  await expect(async () => {
    await canvas.click({ position: { x: bounds.width / 2, y: bounds.height / 2 } });
    await expect(page.locator('.warning-card')).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
  const card = page.locator('.warning-card');
  await expect(card).toContainText('検証地方');
  await expect(card.locator('li')).toHaveText(['レベル３大雨警報', 'レベル２土砂災害注意報']);

  // Hiding the layer hides its card too.
  await page.getByRole('checkbox', { name: '警報・注意報を地図に表示' }).uncheck();
  await expect(card).toBeHidden();
  await page.getByRole('checkbox', { name: '警報・注意報を地図に表示' }).check();

  // A failed check keeps the areas already shown.
  failing = true;
  await page.getByRole('button', { name: '警報・注意報を更新' }).click();
  await expect(section).toContainText('一時的な取得失敗');
  await expect(section).toContainText('取得済みの発表状況を表示しています。');
  await expect(section.locator('summary')).toContainText('警報以上 1区域');

  // Recovery picks up the new report.
  failing = false;
  reports = warningReport([{ code: '43', status: '発表' }], '2026-09-11T21:00:00+09:00');
  await page.getByRole('button', { name: '警報・注意報を更新' }).click();
  await expect(section.locator('.warning-legend')).toContainText(/危険警報\s*1\s*区域/);
});

test('zooming in shows the municipality a warning was issued for', async ({ page }) => {
  await setup(page);
  // The area carries an advisory; the municipality inside it carries the warning.
  await stubWarnings(page, warningReport([{ code: '10', status: '発表' }], '2026-09-11T20:00:00+09:00',
    [{ code: '03', status: '発表' }, { code: '10', status: '発表' }]));
  const shapes: string[] = [];
  page.on('request', request => { if (request.url().includes('/geojson/class20s/')) shapes.push(request.url()); });
  await page.goto('/');
  await expect(page.locator('#section-warning > summary')).toContainText('警報なし');
  // Nothing is loaded for municipalities on the national view.
  await page.waitForTimeout(1_000);
  expect(shapes).toEqual([]);

  const zoomIn = page.getByRole('button', { name: 'Zoom in' });
  for (let step = 0; step < 5; step++) { await zoomIn.click(); await page.waitForTimeout(400); }
  await expect.poll(() => shapes.length, { timeout: 10_000 }).toBe(1);
  expect(shapes[0]).toContain('/class20s/9990100.json');

  const canvas = page.locator('canvas');
  const bounds = (await canvas.boundingBox())!;
  await expect(async () => {
    await canvas.click({ position: { x: bounds.width / 2, y: bounds.height / 2 } });
    await expect(page.locator('.warning-card')).toContainText('検証市', { timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
  await expect(page.locator('.warning-card li')).toHaveText(['レベル３大雨警報', 'レベル２大雨注意報']);
});
