import { test, expect } from '@playwright/test';
import { baseTile, rainTile } from './fixtures/tiles';
const time = (minutesAgo: number) => new Date(Math.floor(Date.now() / 300_000) * 300_000 - minutesAgo * 60_000)
  .toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
const row = (stamp: string) => ({ basetime: stamp, validtime: stamp, elements: ['hrpns'] });

test('controls, failed metadata and failed tiles preserve the displayed frame, then recover', async ({ page }) => {
  const times = [time(10), time(5), time(0)];
  let metadataFails = false;
  let tileFails = false;
  let rows = [row(times[0]), row(times[1])];
  await page.route('**/targetTimes_N1.json', route => metadataFails
    ? route.fulfill({ status: 503, body: 'unavailable' })
    : route.fulfill({ json: rows }));
  await page.route('**/*.png', route => tileFails && route.request().url().includes('/' + times[2] + '/')
    ? route.fulfill({ status: 503, body: 'unavailable' })
    : route.fulfill({ contentType: 'image/png', body: route.request().url().includes('/hrpns/') ? rainTile : baseTile }));
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByTestId('displayed-time')).not.toHaveText('未表示', { timeout: 30_000 });
  const firstTime = await page.getByTestId('displayed-time').textContent();
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
  const mapImage = () => page.screenshot({ clip: { x: 400, y: 180, width: 650, height: 450 } });
  const rainVisible = await mapImage();
  await page.getByRole('checkbox', { name: '降水レイヤーを表示' }).uncheck();
  await expect(page.getByText('降水レイヤーは非表示')).toBeVisible();
  expect((await mapImage()).equals(rainVisible)).toBe(false);
  await page.getByRole('checkbox', { name: '降水レイヤーを表示' }).check();
  await page.getByRole('button', { name: '1つ前の時刻' }).click();
  await expect(page.getByTestId('displayed-time')).not.toHaveText(firstTime!);
  await page.getByRole('button', { name: '最新へ', exact: true }).click();
  await expect(page.getByTestId('displayed-time')).toHaveText(firstTime!);
  metadataFails = true;
  await page.getByRole('button', { name: '更新を確認', exact: true }).click();
  await expect(page.getByText('一時的な取得失敗', { exact: true })).toBeVisible();
  await expect(page.getByTestId('displayed-time')).toHaveText(firstTime!);
  metadataFails = false; tileFails = true; rows = [...rows, row(times[2])];
  const beforeFailure = await mapImage();
  await page.getByRole('button', { name: '更新を確認', exact: true }).click();
  await expect(page.getByText(/降水画像を取得できません/)).toBeVisible();
  await expect(page.getByTestId('displayed-time')).toHaveText(firstTime!);
  expect((await mapImage()).equals(beforeFailure)).toBe(true);
  tileFails = false;
  await page.getByRole('button', { name: '画像を再試行' }).click();
  await expect(page.getByTestId('displayed-time')).not.toHaveText(firstTime!);
  // Keyboard panning and zooming must request a changed set of visible tiles.
  const requests: string[] = [];
  page.on('request', request => { if (request.url().endsWith('.png')) requests.push(request.url()); });
  await canvas.focus();
  await page.keyboard.press('+');
  await expect.poll(() => requests.length).toBeGreaterThan(0);
  requests.length = 0;
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => requests.length).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('first-load errors allow retry and a narrow layout stays usable', async ({ page }) => {
  let failed = true;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/targetTimes_N1.json', route => route.fulfill(failed ? { status: 503 } : { json: [row(time(5)), row(time(0))] }));
  await page.route('**/*.png', route => route.fulfill({ contentType: 'image/png', body: route.request().url().includes('/hrpns/') ? rainTile : baseTile }));
  await page.goto('/');
  await expect(page.getByText('一時的な取得失敗', { exact: true })).toBeVisible();
  await expect(page.getByTestId('displayed-time')).toHaveText('未表示');
  failed = false;
  await page.getByRole('button', { name: '更新を確認', exact: true }).click();
  await expect(page.getByTestId('displayed-time')).not.toHaveText('未表示', { timeout: 30_000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('checkbox', { name: '自動更新', exact: true }).uncheck();
  await expect(page.getByText('自動更新は停止中')).toBeVisible();
});

test('live JMA/GSI data renders in the browser', async ({ page }) => {
  test.skip(process.env.LIVE_WEATHER !== '1', 'Opt-in test makes requests to external data sources.');
  const requests: { url: string; status: number }[] = [];
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => requests.push({ url: response.url(), status: response.status() }));
  await page.goto('/');
  await expect(page.getByTestId('displayed-time')).not.toHaveText('未表示', { timeout: 40_000 });
  expect(requests.some(r => r.url.includes('/hrpns/') && r.status === 200)).toBe(true);
  expect(requests.some(r => r.url.includes('cyberjapandata') && r.status === 200)).toBe(true);
  expect(errors).toEqual([]);
  await page.screenshot({ path: 'test-results/live-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/live-mobile.png', fullPage: true });
});
