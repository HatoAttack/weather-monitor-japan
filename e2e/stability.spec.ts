import { test, expect } from '@playwright/test';
import { appendFileSync, writeFileSync } from 'node:fs';

// Real elapsed time and real upstream data; deliberately separate from fast CI.
test('two-hour live stability with offline recovery', async ({ page, context }, testInfo) => {
  test.skip(process.env.WEATHER_SOAK !== '1', 'Opt-in two-hour live-data validation.');
  const duration = 120 * 60_000;
  test.setTimeout(duration + 180_000);
  const logPath = testInfo.outputPath('samples.jsonl');
  const summaryPath = testInfo.outputPath('summary.json');
  const networkPath = testInfo.outputPath('network.jsonl');
  const errors: string[] = [];
  const counts = { rain: 0, amedas: 0, failed: 0 };
  const samples: object[] = [];
  const startedAt = Date.now();
  let offline = false;
  let beforeOffline: { rain: string | null; amedas: string | null } | undefined;
  const amedas = page.locator('.amedas-controls');
  const times = async () => ({
    rain: await page.getByTestId('displayed-time').textContent(),
    amedas: await amedas.locator('time').textContent(),
  });
  const summary = (status: string, extra = {}) => writeFileSync(summaryPath, JSON.stringify({
    status, startedAt: new Date(startedAt).toISOString(),
    updatedAt: new Date().toISOString(), elapsedMs: Date.now() - startedAt,
    browser: context.browser()?.version(), counts, errors, sampleCount: samples.length,
    memoryScope: 'Chrome main renderer JS heap and DOM counters; excludes workers, GPU and total process memory',
    ...extra,
  }, null, 2));
  const logNetwork = (url: string, details: object) => {
    if (url.includes('targetTimes_N1.json') || url.includes('/amedas/data/')) {
      appendFileSync(networkPath, JSON.stringify({ at: new Date().toISOString(), offline, url, ...details }) + '\n');
    }
  };
  page.on('pageerror', error => errors.push(error.message));
  page.on('crash', () => errors.push('page crashed'));
  page.on('request', request => logNetwork(request.url(), { event: 'request' }));
  page.on('requestfailed', request => {
    counts.failed++;
    logNetwork(request.url(), { event: 'failure', error: request.failure()?.errorText });
  });
  page.on('response', response => {
    logNetwork(response.url(), { event: 'response', status: response.status() });
    if (response.ok() && response.url().includes('targetTimes_N1.json')) counts.rain++;
    if (response.ok() && response.url().includes('/amedas/data/latest_time.txt')) counts.amedas++;
  });
  try {
    await page.goto('/');
    await expect(page.getByTestId('displayed-time')).not.toHaveText('未表示', { timeout: 60_000 });
    await expect(amedas.locator('.amedas-status')).toContainText('更新済み');
    const initialTimes = await times();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Performance.enable');
    await page.screenshot({ path: testInfo.outputPath('start.png') });
    for (let minute = 0; minute <= 120; minute++) {
      if (minute === 20) {
        beforeOffline = await times();
        await context.setOffline(true);
        offline = true;
      }
      if (minute === 32) {
        expect(await times()).toEqual(beforeOffline);
        await expect(amedas).toContainText('一時的な取得失敗');
        await expect(page.getByRole('status').filter({ hasText: '最終確認成功' })).toContainText('一時的な取得失敗');
        await page.screenshot({ path: testInfo.outputPath('offline.png') });
        await context.setOffline(false);
        offline = false;
      }
      if (minute === 45) {
        const recovered = await times();
        expect(recovered.rain).not.toEqual(beforeOffline?.rain);
        expect(recovered.amedas).not.toEqual(beforeOffline?.amedas);
        await expect(amedas).not.toContainText('一時的な取得失敗');
        await page.screenshot({ path: testInfo.outputPath('recovered.png') });
      }
      const metrics = await cdp.send('Performance.getMetrics');
      const dom = await cdp.send('Memory.getDOMCounters');
      const sample = {
        at: new Date().toISOString(), elapsedMs: Date.now() - startedAt, minute, offline,
        times: await times(), counts: { ...counts }, dom,
        visibility: await page.evaluate(() => document.visibilityState),
        amedasStatus: await amedas.locator('.amedas-status').textContent(),
        metrics: Object.fromEntries(metrics.metrics.filter(m =>
          ['JSHeapUsedSize', 'JSHeapTotalSize', 'Documents', 'Nodes', 'JSEventListeners'].includes(m.name)
        ).map(m => [m.name, m.value])),
      };
      samples.push(sample);
      appendFileSync(logPath, JSON.stringify(sample) + '\n');
      summary('running');
      if (minute % 10 === 0) console.log(`Stability ${minute}/120 min: ${JSON.stringify(sample)}`);
      if (minute < 120) await new Promise(resolve => setTimeout(resolve, 60_000));
    }
    const finalTimes = await times();
    expect(finalTimes.rain).not.toEqual(initialTimes.rain);
    expect(finalTimes.amedas).not.toEqual(initialTimes.amedas);
    expect(counts.rain).toBeGreaterThanOrEqual(18);
    expect(counts.amedas).toBeGreaterThanOrEqual(9);
    expect(errors).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath('end.png') });
    summary('passed', { initialTimes, finalTimes });
  } catch (error) {
    summary('failed', { failure: String(error) });
    throw error;
  } finally {
    await context.setOffline(false);
  }
});
