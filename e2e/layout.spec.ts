import { test, expect, type Page } from '@playwright/test';
import { baseTile } from './fixtures/tiles';
import { stubWarnings } from './fixtures/warnings';

async function stubData(page: Page) {
  await page.route('**/targetTimes_N1.json', route => route.fulfill({ json: [] }));
  await page.route('**/targetTimes_N2.json', route => route.fulfill({ json: [] }));
  await stubWarnings(page);
  await page.route('**/amedas/**', route => route.abort());
  await page.route('**/*.pbf', route => route.fulfill({ contentType: 'application/x-protobuf', body: '' }));
  await page.route('**/*.png', route => route.fulfill({ contentType: 'image/png', body: baseTile }));
}

const panel = (page: Page) => page.getByRole('complementary', { name: '表示と更新の操作' });
const map = (page: Page) => page.locator('canvas');

test('the map fills the window with the sidebar floating over it', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await stubData(page);
  await page.goto('/');
  // No header band: the map starts at the top of the window and reaches the bottom.
  await expect(page.getByRole('banner')).toHaveCount(0);
  const view = page.viewportSize()!;
  const region = (await map(page).boundingBox())!;
  expect(region.y).toBe(0);
  expect(Math.round(region.height)).toBe(view.height);
  // The sidebar overlaps the map rather than sitting beside it.
  const sidebar = (await panel(page).boundingBox())!;
  expect(sidebar.x).toBeGreaterThan(0);
  expect(sidebar.x + sidebar.width).toBeLessThan(view.width);
  await expect(page.getByRole('heading', { level: 1, name: '日本の気象観測' })).toBeVisible();
});

test('a narrow screen keeps the panel as a bottom sheet that opens and closes', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await stubData(page);
  await page.goto('/');
  const view = page.viewportSize()!;
  const open = page.getByRole('button', { name: '表示と更新の操作' });
  await expect(open).toHaveAttribute('aria-expanded', 'false');
  // Closed: only the handle shows, and the map stays visible above it.
  const closed = (await panel(page).boundingBox())!;
  expect(closed.height).toBeLessThanOrEqual(80);
  expect(Math.round(closed.y + closed.height)).toBe(view.height);
  await expect(page.getByRole('heading', { level: 2, name: '雨雲' })).toBeHidden();
  await open.click();
  const shown = page.getByRole('button', { name: '操作を閉じる' });
  await expect(shown).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('heading', { level: 2, name: '雨雲' })).toBeVisible();
  const opened = (await panel(page).boundingBox())!;
  expect(opened.height).toBeGreaterThan(closed.height);
  // Even open, the sheet leaves part of the map uncovered.
  expect(opened.y).toBeGreaterThan(0);
  await shown.click();
  await expect(page.getByRole('heading', { level: 2, name: '雨雲' })).toBeHidden();
});
