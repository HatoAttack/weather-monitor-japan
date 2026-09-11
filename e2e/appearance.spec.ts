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

for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
  test(`every control is at least 44px square at ${viewport.width}px wide`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await stubData(page);
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Zoom in' })).toBeVisible();
    const closed = page.locator('details:not([open]) > summary');
    while (await closed.count()) await closed.first().click();
    const undersized = await page.evaluate(() => [...document.querySelectorAll('button, select, summary, input')]
      .filter(element => element.checkVisibility())
      .map(element => {
        // A checkbox is hit through its whole label row.
        const box = (element.closest('label') ?? element).getBoundingClientRect();
        return { name: element.getAttribute('aria-label') ?? element.textContent?.trim(), width: box.width, height: box.height };
      })
      .filter(target => target.width < 44 || target.height < 44));
    expect(undersized).toEqual([]);
  });
}

test('the panel floats on a translucent material by default', async ({ page }) => {
  await stubData(page);
  await page.goto('/');
  await expect(panel(page)).toHaveCSS('background-color', 'rgba(250, 250, 252, 0.9)');
  await expect(panel(page)).not.toHaveCSS('backdrop-filter', 'none');
});

test('the interface follows the dark appearance', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await stubData(page);
  await page.goto('/');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(0, 0, 0)');
  await expect(panel(page)).toHaveCSS('color', 'rgb(245, 245, 247)');
  await expect(panel(page)).toHaveCSS('background-color', 'rgba(28, 28, 30, 0.92)');
});

for (const feature of [{ name: 'prefers-reduced-transparency', value: 'reduce' }, { name: 'prefers-contrast', value: 'more' }]) {
  test(`the panel turns opaque with ${feature.name}: ${feature.value}`, async ({ page }) => {
    // Playwright has no option for reduced transparency, so both go through DevTools emulation.
    const devtools = await page.context().newCDPSession(page);
    await devtools.send('Emulation.setEmulatedMedia', { features: [feature] });
    await stubData(page);
    await page.goto('/');
    await expect(panel(page)).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect(panel(page)).toHaveCSS('backdrop-filter', 'none');
  });
}
