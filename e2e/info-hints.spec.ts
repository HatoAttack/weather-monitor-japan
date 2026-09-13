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

const hint = (page: Page) => page.getByRole('button', { name: '警報・注意報の表示についての説明' });
const text = (page: Page) => page.getByText('区域ごとに、発表中で最も重いものの色で塗ります。');

test('an explanation stays out of the panel until its ⓘ is used', async ({ page }) => {
  await stubData(page);
  await page.goto('/');
  await page.getByRole('heading', { level: 2, name: '警報・注意報' }).click();
  await expect(hint(page)).toBeVisible();
  await expect(hint(page)).toHaveAttribute('aria-expanded', 'false');
  await expect(text(page)).toBeHidden();

  // Hovering is enough on a pointer device.
  await hint(page).hover();
  await expect(text(page)).toBeVisible();
  await page.mouse.move(0, 0);
  await expect(text(page)).toBeHidden();

  // A tap or click keeps it open until it is dismissed.
  await hint(page).click();
  await expect(hint(page)).toHaveAttribute('aria-expanded', 'true');
  await page.mouse.move(0, 0);
  await expect(text(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(hint(page)).toHaveAttribute('aria-expanded', 'false');
  await expect(text(page)).toBeHidden();
});

test('the explanation opens from the keyboard and fits inside the panel', async ({ page }) => {
  await stubData(page);
  await page.goto('/');
  await page.getByRole('heading', { level: 2, name: '警報・注意報' }).click();
  await hint(page).focus();
  // Focus alone shows it, so a keyboard reaches the same text as a pointer.
  await expect(text(page)).toBeVisible();
  const fits = await page.evaluate(() => {
    const popup = document.querySelector('.info-hint:focus-within .info-popup')!.getBoundingClientRect();
    const panel = document.querySelector('.panel')!.getBoundingClientRect();
    return popup.left >= panel.left && popup.right <= panel.right
      && popup.top >= panel.top && popup.bottom <= panel.bottom;
  });
  expect(fits).toBe(true);
});
