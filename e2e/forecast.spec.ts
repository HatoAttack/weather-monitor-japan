import { test, expect } from '@playwright/test';
import { baseTile, rainTile } from './fixtures/tiles';
import { stubWarnings } from './fixtures/warnings';

const stamp = (minutesFromNow: number) =>
  new Date(Math.floor(Date.now() / 300_000) * 300_000 + minutesFromNow * 60_000)
    .toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
const row = (base: string, valid = base) => ({ basetime: base, validtime: valid, elements: ['hrpns'] });

test('the nowcast continues the timeline past the newest observation', async ({ page }) => {
  const past = [stamp(-10), stamp(-5), stamp(0)];
  const now = past[2];
  const ahead = [stamp(5), stamp(10), stamp(15)];
  await page.route('**/targetTimes_N1.json', route => route.fulfill({ json: past.map(time => row(time)) }));
  await page.route('**/targetTimes_N2.json', route => route.fulfill({ json: ahead.map(valid => row(now, valid)) }));
  await stubWarnings(page);
  await page.route('**/amedas/**', route => route.abort());
  await page.route('**/*.pbf', route => route.fulfill({ contentType: 'application/x-protobuf', body: '' }));
  await page.route('**/*.png', route => route.fulfill({
    contentType: 'image/png', body: route.request().url().includes('/hrpns/') ? rainTile : baseTile,
  }));
  await page.goto('/');
  const displayed = page.getByTestId('displayed-time');
  await expect(displayed).not.toHaveText('未表示', { timeout: 30_000 });

  // Six times in one list: three observations, then three forecasts.
  const selected = page.locator('#frame-time');
  await expect(selected.locator('option')).toHaveCount(6);
  await expect(selected.locator('option').nth(2)).toContainText('（現在）');
  await expect(selected.locator('option').nth(3)).toContainText('（予測）');
  await expect(selected.locator('option').nth(5)).toContainText('（予測）');
  // The newest observation is shown first, not the far end of the forecast.
  const start = await selected.inputValue();
  expect(await selected.locator('option').nth(2).getAttribute('value')).toBe(start);

  // Stepping forward reaches the forecast, and says so.
  const note = page.locator('.forecast-note');
  await page.getByRole('button', { name: '1つ後の時刻' }).click();
  await expect(note).toContainText('時点の1時間先までの見通し');
  await expect(displayed).not.toHaveText('未表示');
  await page.getByRole('button', { name: '現在へ', exact: true }).click();
  await expect(selected).toHaveValue(start);
  await expect(note).toHaveCount(0);
});

test('a failed nowcast leaves the observations usable', async ({ page }) => {
  const past = [stamp(-5), stamp(0)];
  await page.route('**/targetTimes_N1.json', route => route.fulfill({ json: past.map(time => row(time)) }));
  await page.route('**/targetTimes_N2.json', route => route.fulfill({ status: 503, body: 'unavailable' }));
  await stubWarnings(page);
  await page.route('**/amedas/**', route => route.abort());
  await page.route('**/*.pbf', route => route.fulfill({ contentType: 'application/x-protobuf', body: '' }));
  await page.route('**/*.png', route => route.fulfill({
    contentType: 'image/png', body: route.request().url().includes('/hrpns/') ? rainTile : baseTile,
  }));
  await page.goto('/');
  await expect(page.getByTestId('displayed-time')).not.toHaveText('未表示', { timeout: 30_000 });
  await expect(page.getByText('降水予測を取得できていません。実況のみ表示しています。')).toBeVisible();
  await expect(page.locator('#frame-time').locator('option')).toHaveCount(2);
});
