import { test, expect, type Page } from '@playwright/test';
import { baseTile, emptyTile, rainTile } from './fixtures/tiles';
import { stubWarnings } from './fixtures/warnings';
const time = (minutesAgo: number) => new Date(Math.floor(Date.now() / 300_000) * 300_000 - minutesAgo * 60_000)
  .toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
const row = (stamp: string) => ({ basetime: stamp, validtime: stamp, elements: ['hrpns'] });
const amedasTable = {
  '44132': { lat: [35, 41.4], lon: [139, 45.0], alt: 25, kjName: '東京' },
  '62078': { lat: [34, 40.9], lon: [135, 31.1], alt: 23, kjName: '大阪' },
};
const amedasData = {
  '44132': { temp: [31.2, 0], precipitation1h: [2.5, 0], windDirection: [4, 0], wind: [3.6, 0] },
  '62078': { temp: [29.1, 0], precipitation1h: [0, 0], windDirection: [8, 0], wind: [4.1, 0] },
};
async function mockAmedas(page: Page) {
  await page.route('**/amedas/data/latest_time.txt', route => route.fulfill({ body: '2026-09-08T23:30:00+09:00' }));
  await page.route('**/amedas/const/amedastable.json', route => route.fulfill({ json: amedasTable }));
  await page.route('**/amedas/data/map/*.json', route => route.fulfill({ json: amedasData }));
}

test('controls, failed metadata and failed tiles preserve the displayed frame, then recover', async ({ page }) => {
  await mockAmedas(page);
  const times = [time(10), time(5), time(0)];
  let metadataFails = false;
  let tileFails = false;
  let rows = [row(times[0]), row(times[1])];
  // The nowcast is fetched alongside; these tests cover observations only.
  await page.route('**/targetTimes_N2.json', route => route.fulfill({ json: [] }));
  await stubWarnings(page);
  await page.route('**/targetTimes_N1.json', route => metadataFails
    ? route.fulfill({ status: 503, body: 'unavailable' })
    : route.fulfill({ json: rows }));
  await page.route('**/*.pbf', route => route.fulfill({ contentType: 'application/x-protobuf', body: '' }));
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
  await page.getByRole('button', { name: '現在へ', exact: true }).click();
  await expect(page.getByTestId('displayed-time')).toHaveText(firstTime!);
  metadataFails = true;
  await page.getByRole('button', { name: '雨雲を更新', exact: true }).click();
  await expect(page.getByText('一時的な取得失敗', { exact: true })).toBeVisible();
  await expect(page.getByTestId('displayed-time')).toHaveText(firstTime!);
  metadataFails = false; tileFails = true; rows = [...rows, row(times[2])];
  const beforeFailure = await mapImage();
  await page.getByRole('button', { name: '雨雲を更新', exact: true }).click();
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
  await mockAmedas(page);
  let failed = true;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/targetTimes_N1.json', route => route.fulfill(failed ? { status: 503 } : { json: [row(time(5)), row(time(0))] }));
  // The nowcast is fetched alongside; these tests cover observations only.
  await page.route('**/targetTimes_N2.json', route => route.fulfill({ json: [] }));
  await stubWarnings(page);
  await page.route('**/*.pbf', route => route.fulfill({ contentType: 'application/x-protobuf', body: '' }));
  await page.route('**/*.png', route => route.fulfill({ contentType: 'image/png', body: route.request().url().includes('/hrpns/') ? rainTile : baseTile }));
  await page.goto('/');
  await expect(page.getByText('一時的な取得失敗', { exact: true })).toBeVisible();
  await expect(page.getByTestId('displayed-time')).toHaveText('未表示');
  failed = false;
  await page.getByRole('button', { name: '雨雲を更新', exact: true }).click();
  await expect(page.getByTestId('displayed-time')).not.toHaveText('未表示', { timeout: 30_000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('checkbox', { name: '自動更新', exact: true }).uncheck();
  await expect(page.getByText('自動更新は停止中')).toBeVisible();
});

test('precipitation stays visible across zoom levels JMA leaves empty', async ({ page }) => {
  await mockAmedas(page);
  await page.route('**/targetTimes_N1.json', route => route.fulfill({ json: [row(time(5)), row(time(0))] }));
  // The nowcast is fetched alongside; these tests cover observations only.
  await page.route('**/targetTimes_N2.json', route => route.fulfill({ json: [] }));
  await stubWarnings(page);
  const requested: number[] = [];
  await page.route('**/*.pbf', route => route.fulfill({ contentType: 'application/x-protobuf', body: '' }));
  await page.route('**/*.png', route => {
    const url = route.request().url();
    if (!url.includes('/hrpns/')) return route.fulfill({ contentType: 'image/png', body: baseTile });
    // JMA publishes precipitation tiles only at even zoom levels.
    const zoom = Number(url.split('/hrpns/')[1].split('/')[0]);
    requested.push(zoom);
    return route.fulfill({ contentType: 'image/png', body: zoom % 2 === 0 ? rainTile : emptyTile });
  });
  await page.goto('/');
  await expect(page.getByTestId('displayed-time')).not.toHaveText('未表示', { timeout: 30_000 });
  const canvas = page.locator('canvas');
  const bounds = (await canvas.boundingBox())!;
  const clip = { x: bounds.x + bounds.width / 2 - 120, y: bounds.y + bounds.height / 2 - 90, width: 240, height: 180 };
  const layer = page.getByRole('checkbox', { name: '降水レイヤーを表示' });
  const zoomOut = page.getByRole('button', { name: 'Zoom out' });
  const zoomIn = page.getByRole('button', { name: 'Zoom in' });
  for (let step = 0; step < 4; step++) await zoomOut.click();
  for (let step = 0; step <= 6; step++) {
    if (step) await zoomIn.click();
    await expect(async () => {
      const withRain = await page.screenshot({ clip });
      await layer.uncheck();
      await page.waitForTimeout(400);
      const withoutRain = await page.screenshot({ clip });
      await layer.check();
      await page.waitForTimeout(400);
      expect(withoutRain.equals(withRain)).toBe(false);
      expect((await page.screenshot({ clip })).equals(withRain)).toBe(true);
    }).toPass({ timeout: 25_000 });
  }
  expect(requested.every(zoom => zoom % 2 === 0)).toBe(true);
});

test('playback steps through frames, stops on the newest, repeats and yields to manual control', async ({ page }) => {
  await mockAmedas(page);
  const times = [time(10), time(5), time(0)];
  await page.route('**/targetTimes_N1.json', route => route.fulfill({ json: times.map(row) }));
  // The nowcast is fetched alongside; these tests cover observations only.
  await page.route('**/targetTimes_N2.json', route => route.fulfill({ json: [] }));
  await stubWarnings(page);
  await page.route('**/*.pbf', route => route.fulfill({ contentType: 'application/x-protobuf', body: '' }));
  await page.route('**/*.png', route => route.fulfill({
    contentType: 'image/png', body: route.request().url().includes('/hrpns/') ? rainTile : baseTile,
  }));
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  const displayed = page.getByTestId('displayed-time');
  await expect(displayed).not.toHaveText('未表示', { timeout: 30_000 });
  const latest = await displayed.textContent();
  const play = page.getByRole('button', { name: '再生', exact: true });
  const pause = page.getByRole('button', { name: '一時停止', exact: true });
  // The selected time is the frame playback steps through, independent of image loading.
  const selected = page.locator('#frame-time');
  const slow = page.getByRole('button', { name: '低速', exact: true });
  await slow.click();
  await expect(slow).toHaveAttribute('aria-pressed', 'true');

  // Without repeat, playback replays from the oldest frame and ends on the newest.
  await page.getByRole('checkbox', { name: '繰り返し' }).uncheck();
  await play.click();
  await expect(displayed).not.toHaveText(latest!, { timeout: 20_000 });
  await expect(play).toBeVisible({ timeout: 20_000 });
  await expect(displayed).toHaveText(latest!, { timeout: 20_000 });
  const ended = await selected.inputValue();
  await page.waitForTimeout(3_000);
  expect(await selected.inputValue()).toBe(ended);

  // With repeat, playback wraps around instead of stopping.
  await page.getByRole('checkbox', { name: '繰り返し' }).check();
  await play.click();
  await expect(displayed).not.toHaveText(latest!, { timeout: 20_000 });
  await expect(displayed).toHaveText(latest!, { timeout: 20_000 });
  await expect(displayed).not.toHaveText(latest!, { timeout: 20_000 });
  await pause.click();
  await expect(play).toBeVisible();
  const paused = await selected.inputValue();
  await page.waitForTimeout(3_000);
  expect(await selected.inputValue()).toBe(paused);

  // A hidden precipitation layer has nothing to animate.
  await page.getByRole('checkbox', { name: '降水レイヤーを表示' }).uncheck();
  await expect(play).toBeDisabled();
  await page.getByRole('checkbox', { name: '降水レイヤーを表示' }).check();
  await expect(play).toBeEnabled();

  // Choosing a time by hand stops playback and keeps that frame on screen.
  await play.click();
  await page.getByRole('button', { name: '1つ前の時刻' }).click();
  await expect(play).toBeVisible();
  const chosen = await selected.inputValue();
  await page.waitForTimeout(3_000);
  expect(await selected.inputValue()).toBe(chosen);
  await expect(displayed).not.toHaveText('未表示');
  expect(errors).toEqual([]);
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
  expect(requests.some(r => r.url.includes('/amedas/data/map/') && r.status === 200)).toBe(true);
  await page.locator('#section-satellite > summary').click();
  await page.getByRole('checkbox', { name: '衛星画像を表示' }).check();
  await expect(page.getByTestId('satellite-time')).not.toHaveText('未表示', { timeout: 25_000 });
  expect(requests.some(r => r.url.includes('/himawari/data/satimg/') && r.url.endsWith('.jpg') && r.status === 200)).toBe(true);
  expect(errors).toEqual([]);
  await page.screenshot({ path: 'test-results/live-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/live-mobile.png', fullPage: true });
});
