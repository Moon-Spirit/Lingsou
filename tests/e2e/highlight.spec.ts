import { test, expect } from './fixtures/seed.js';

test('search results have mark highlights', async ({ page }) => {
  await page.goto('/');
  await page.fill('#sb-input', '灵搜');
  await page.click('button[type="submit"]');

  await expect(page.locator('.result-list article').first()).toBeVisible({ timeout: 10_000 });

  const html = await page.locator('.result-list article').first().innerHTML();
  expect(html).toContain('<mark>');
  expect(html).toContain('</mark>');

  await page.screenshot({ path: 'test-results/task-23-highlight.png', fullPage: true });
});
