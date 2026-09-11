import { test, expect, chromium, type Browser } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { baseTile, rainTile } from './fixtures/tiles';
import { stubWarnings } from './fixtures/warnings';

test('native tab visibility suppresses polling and resumes both weather sources', async ({ baseURL }, testInfo) => {
  test.skip(process.env.REAL_TAB_VISIBILITY !== '1', 'Opt-in native Chrome tab test using an isolated profile.');
  const executable = process.env.PLAYWRIGHT_CHROME_PATH;
  if (!executable) throw new Error('PLAYWRIGHT_CHROME_PATH is required for native Chrome validation.');
  const profile = testInfo.outputPath('chrome-profile');
  await mkdir(profile, { recursive: true });
  // A direct launch avoids Playwright's forced focus emulation. The fresh profile
  // and off-screen window leave the user's browser and the live soak test alone.
  const chrome = spawn(executable, [
    `--user-data-dir=${profile}`, '--remote-debugging-port=0',
    '--no-first-run', '--no-default-browser-check', '--window-position=-10000,-10000',
    '--window-size=1280,900', '--disable-background-networking',
    '--disable-features=CalculateNativeWinOcclusion', 'about:blank',
  ], { windowsHide: true, stdio: 'ignore' });
  let launchError: Error | undefined;
  chrome.on('error', error => { launchError = error; });
  let browser: Browser | undefined;
  const checkpoints: object[] = [];
  try {
    const activePort = join(profile, 'DevToolsActivePort');
    await expect.poll(async () => {
      if (launchError) throw launchError;
      return readFile(activePort, 'utf8').catch(() => '');
    }, { timeout: 15_000 }).toMatch(/^\d+\r?\n/);
    const port = (await readFile(activePort, 'utf8')).split('\n')[0].trim();
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`, { noDefaults: true });
    const context = browser.contexts()[0];
    const page = context.pages()[0];
    const counts = { rain: 0, amedas: 0 };
    const errors: string[] = [];
    let stamp = '20260909090000';
    let latestTime = '2026-09-09T18:00:00+09:00';
    // The nowcast is fetched alongside; this test covers observations only.
    await context.route('**/targetTimes_N2.json', route => route.fulfill({ json: [] }));
    await stubWarnings(context);
    await context.route('**/targetTimes_N1.json', route => {
      counts.rain++;
      return route.fulfill({ json: [{ basetime: stamp, validtime: stamp, elements: ['hrpns'] }] });
    });
    await context.route('**/amedas/data/latest_time.txt', route => {
      counts.amedas++;
      return route.fulfill({ body: latestTime });
    });
    await context.route('**/amedas/const/amedastable.json', route => route.fulfill({ json: {
      '44132': { lat: [35, 41.4], lon: [139, 45.0], alt: 25, kjName: '東京' },
    } }));
    await context.route('**/amedas/data/map/*.json', route => route.fulfill({ json: {
      '44132': { temp: [30, 0], precipitation1h: [0, 0], windDirection: [4, 0], wind: [3, 0] },
    } }));
    await context.route('**/*.pbf', route => route.fulfill({ contentType: 'application/x-protobuf', body: '' }));
    await context.route('**/*.png', route => route.fulfill({
      contentType: 'image/png', body: route.request().url().includes('/hrpns/') ? rainTile : baseTile,
    }));
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.install({ time: new Date('2026-09-09T09:01:00Z') });
    await page.goto(baseURL!);
    await page.bringToFront();
    await expect.poll(() => page.evaluate(() => document.visibilityState)).toBe('visible');
    await expect(page.getByTestId('displayed-time')).toHaveText('09/09 18:00', { timeout: 20_000 });
    const amedasTime = page.locator('.amedas-controls time');
    await expect(amedasTime).toHaveText('09/09 18:00');
    const baseline = { ...counts };
    checkpoints.push({ stage: 'initial', visibility: 'visible', counts: baseline });
    await page.screenshot({ path: testInfo.outputPath('initial.png') });

    const other = await context.newPage();
    await other.goto('about:blank');
    await other.bringToFront();
    await expect.poll(() => page.evaluate(() => document.visibilityState)).toBe('hidden');
    // Only elapsed time is accelerated; document.hidden and visibilitychange
    // come from native tab activation, with no getters or events mocked.
    await page.clock.fastForward('11:00');
    expect(counts).toEqual(baseline);
    checkpoints.push({ stage: 'hidden-after-11-virtual-minutes', visibility: 'hidden', counts: { ...counts } });

    stamp = '20260909091000';
    latestTime = '2026-09-09T18:10:00+09:00';
    await page.bringToFront();
    await expect.poll(() => page.evaluate(() => document.visibilityState)).toBe('visible');
    await expect(page.getByTestId('displayed-time')).toHaveText('09/09 18:10');
    await expect(amedasTime).toHaveText('09/09 18:10');
    expect(counts).toEqual({ rain: baseline.rain + 1, amedas: baseline.amedas + 1 });
    checkpoints.push({ stage: 'resumed', visibility: 'visible', counts: { ...counts } });

    await other.bringToFront();
    await expect.poll(() => page.evaluate(() => document.visibilityState)).toBe('hidden');
    await page.bringToFront();
    await expect.poll(() => page.evaluate(() => document.visibilityState)).toBe('visible');
    await page.clock.fastForward('00:01');
    expect(counts).toEqual({ rain: baseline.rain + 1, amedas: baseline.amedas + 1 });
    expect(errors).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath('resumed.png') });
    await writeFile(testInfo.outputPath('summary.json'), JSON.stringify({
      status: 'passed', at: new Date().toISOString(), browser: browser.version(),
      timing: '11 minutes advanced with Playwright clock; native visibility and tab activation',
      checkpoints, rapidReturnCounts: counts, errors,
    }, null, 2));
  } catch (error) {
    await writeFile(testInfo.outputPath('summary.json'), JSON.stringify({
      status: 'failed', at: new Date().toISOString(), checkpoints, error: String(error),
    }, null, 2));
    throw error;
  } finally {
    if (browser) {
      const session = await browser.newBrowserCDPSession();
      await session.send('Browser.close').catch(() => {});
      await browser.close();
    }
    if (chrome.exitCode === null) chrome.kill();
  }
});
